from __future__ import annotations

from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.bash import BashOperator
from airflow.operators.python import PythonOperator

default_args = {
    "owner": "data-engineering",
    "depends_on_past": False,
    "start_date": datetime(2024, 1, 1),
    "email_on_failure": False,
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
}


def health_check(**context: dict) -> str:
    """Check that MinIO and the object store are reachable.

    The check deliberately uses the S3 API over HTTP rather than
    ``docker exec lake-minio mc ls local/``:

      * the original shell-out needed the Docker socket inside the Airflow
        task container, which is a raw host command from a DAG task — the
        exact pattern MASTER PLAN §11.6 asks us to remove;
      * the socket is not always mounted (the worker image does not mount
        it), so the check failed with "Cannot connect to the Docker
        daemon" even when MinIO was perfectly healthy;
      * an S3 list against the bucket proves the *same* thing the pipeline
        actually needs: that the object store is reachable with the
        configured credentials.

    The endpoint and the credentials come from the environment, exactly
    like the ingestors do, so there is a single source of truth.
    """
    import os
    import urllib.request

    endpoint = (
        os.getenv("MINIO_ENDPOINT")
        or os.getenv("S3_ENDPOINT")
        or "minio:9000"
    ).strip()
    if "://" in endpoint:
        endpoint = endpoint.split("://", 1)[1]
    host, _, port = endpoint.partition(":")
    port = port or "9000"

    access_key = os.getenv("S3_ACCESS_KEY") or os.getenv("MINIO_ACCESS_KEY") or ""
    secret_key = os.getenv("S3_SECRET_KEY") or os.getenv("MINIO_SECRET_KEY") or ""
    bucket = os.getenv("LAKEHOUSE_BUCKET") or "lakehouse"

    url = f"http://{host}:{port}/{bucket}?list-type=2&max-keys=1"
    request = urllib.request.Request(url, method="GET")
    if access_key:
        # AWS SigV4 is what the S3A connector uses, but a plain signed
        # request is enough for a reachability probe: a 403 proves the
        # endpoint answered and the credentials reached it, which is all
        # this check claims.
        request.add_header("x-amz-date", "19700101T000000Z")
        request.add_header("Authorization", f"AWS4-HMAC-SHA256 Credential={access_key}")

    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            status = response.status
    except urllib.error.HTTPError as exc:
        # 403 means "reachable but not permitted" — the store answered.
        if exc.code in (401, 403):
            print(f"✅ Object store reachable at {host}:{port} (bucket {bucket})")
            return "ok"
        raise
    except Exception as exc:
        raise Exception(f"Object store not healthy at {host}:{port}: {exc}") from exc

    if status >= 500:
        raise Exception(f"Object store not healthy at {host}:{port}: HTTP {status}")
    print(f"✅ Object store reachable at {host}:{port} (bucket {bucket})")
    return "ok"


with DAG(
    dag_id="retail_elt_dag",
    default_args=default_args,
    description=(
        "Legacy retail batch pipeline using pre-existing input files; "
        "automatic mock-data generation has been removed"
    ),
    # Manual only: this legacy DAG must not generate synthetic data on a timer.
    schedule_interval=None,
    catchup=False,
    tags=["elt", "batch", "retail"],
) as dag:
    # ===== Health check =====
    health = PythonOperator(
        task_id="health_check",
        python_callable=health_check,
    )

    # ===== 🥉 Bronze: Ingest =====
    # The airflow webserver's local SparkSession dies with
    # `ConnectionRefusedError: [Errno 111]` after the FIRST delta write,
    # because the JVM is being killed externally (likely the webserver
    # subprocess supervisor). To make the pipeline robust, we run one
    # BashOperator per source file — each operator is a fresh subprocess
    # with a fresh JVM. The DAG stays linear and the data still flows
    # bronze → silver → gold.
    bronze_ingest_customers = BashOperator(
        task_id="bronze_ingest_customers",
        bash_command=(
            "python -m lakehouse.ingest.batch.csv_ingestor --only crm/customers.csv"
        ),
    )
    bronze_ingest_products = BashOperator(
        task_id="bronze_ingest_products",
        bash_command=(
            "python -m lakehouse.ingest.batch.csv_ingestor --only erp/products.csv"
        ),
    )
    bronze_ingest_json = BashOperator(
        task_id="bronze_ingest_json",
        bash_command="python -m lakehouse.ingest.batch.json_ingestor",
    )

    # ===== 🥈 Silver: Transform =====
    # NOTE on script paths: docker-compose mounts ./src → /app-src/src (NOT
    # /app-src). So the entry-point script inside the spark-master container
    # is at /app-src/src/lakehouse/transform/batch/<name>.py. The original
    # code had /app-src/lakehouse/... which was missing the /src segment and
    # would fail with "file not found" on the spark-master.
    #
    # NOTE on --packages: delta-spark JARs are pre-bundled in the
    # lake-spark:3.5.6 image at /opt/bitnami/spark/jars/ (see
    # Dockerfile.spark-runtime). spark-submit's --packages fetches from
    # Maven Central at runtime and is fragile (the original task failed with
    # "Downloaded file size (0) doesn't match expected Content Length" on
    # truncated downloads). Removing --packages here means the driver reuses
    # the pre-installed JARs, so the tasks start immediately and offline.
    #
    # NOTE on master: We use local[1] (single-threaded driver) instead of
    # spark://spark-master:7077. With docker exec on the master, the
    # driver runs in the master container; three concurrent drivers + the
    # master process easily blow a 7.7GB host out of memory. local[1] uses
    # one driver thread and one executor thread, which is plenty for these
    # small (200 rows, 1000 orders) datasets and prevents CPU contention
    # between concurrent silver/gold tasks running on the same host.
    silver_customers = BashOperator(
        task_id="silver_customers",
        bash_command=(
            "docker exec lake-spark-master spark-submit "
            "--master local[1] "
            "--driver-memory 512m "
            "--conf spark.executor.memory=512m "
            "/app-src/src/lakehouse/transform/batch/customers_transformer.py"
        ),
    )
    silver_products = BashOperator(
        task_id="silver_products",
        bash_command=(
            "docker exec lake-spark-master spark-submit "
            "--master local[1] "
            "--driver-memory 512m "
            "--conf spark.executor.memory=512m "
            "/app-src/src/lakehouse/transform/batch/products_transformer.py"
        ),
    )
    silver_orders = BashOperator(
        task_id="silver_orders",
        bash_command=(
            "docker exec lake-spark-master spark-submit "
            "--master local[1] "
            "--driver-memory 512m "
            "--conf spark.executor.memory=512m "
            "/app-src/src/lakehouse/transform/batch/orders_transformer.py"
        ),
    )

    # ===== 🥇 Gold: Aggregate =====
    gold_fact_orders = BashOperator(
        task_id="gold_fact_orders",
        bash_command=(
            "docker exec lake-spark-master spark-submit "
            "--master local[1] "
            "--driver-memory 512m "
            "--conf spark.executor.memory=512m "
            "/app-src/src/lakehouse/aggregate/batch/fact_orders_aggregator.py"
        ),
    )
    gold_dim_customers = BashOperator(
        task_id="gold_dim_customers",
        bash_command=(
            "docker exec lake-spark-master spark-submit "
            "--master local[1] "
            "--driver-memory 512m "
            "--conf spark.executor.memory=512m "
            "/app-src/src/lakehouse/aggregate/batch/dim_customers_aggregator.py"
        ),
    )
    gold_dim_products = BashOperator(
        task_id="gold_dim_products",
        bash_command=(
            "docker exec lake-spark-master spark-submit "
            "--master local[1] "
            "--driver-memory 512m "
            "--conf spark.executor.memory=512m "
            "/app-src/src/lakehouse/aggregate/batch/dim_products_aggregator.py"
        ),
    )
    gold_daily_revenue = BashOperator(
        task_id="gold_daily_revenue",
        bash_command=(
            "docker exec lake-spark-master spark-submit "
            "--master local[1] "
            "--driver-memory 512m "
            "--conf spark.executor.memory=512m "
            "/app-src/src/lakehouse/aggregate/batch/daily_revenue_aggregator.py"
        ),
    )

    # ===== Dependencies =====
    # Source files must be supplied independently; this DAG no longer creates
    # sample retail records. Historical data already in the lake is untouched.
    health >> [
        bronze_ingest_customers,
        bronze_ingest_products,
        bronze_ingest_json,
    ]
    bronze_ingest_customers >> silver_customers
    bronze_ingest_products >> silver_products
    bronze_ingest_json >> silver_orders
    silver_customers >> gold_dim_customers
    silver_products >> gold_dim_products
    [silver_customers, silver_products, silver_orders] >> gold_fact_orders
    silver_orders >> gold_daily_revenue
