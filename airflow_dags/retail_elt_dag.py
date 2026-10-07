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
    """Check MinIO + Spark healthy."""
    import subprocess

    result = subprocess.run(
        ["docker", "exec", "lake-minio", "mc", "ls", "local/"],
        capture_output=True,
        text=True,
        timeout=10,
    )
    if result.returncode != 0:
        raise Exception(f"MinIO not healthy: {result.stderr}")
    print("✅ MinIO healthy")
    return "ok"


with DAG(
    dag_id="retail_elt_dag",
    default_args=default_args,
    description="Retail ELT pipeline (Bronze → Silver → Gold) using lakehouse package",
    schedule_interval=timedelta(hours=24),
    catchup=False,
    tags=["elt", "batch", "retail"],
) as dag:
    # ===== Health check =====
    health = PythonOperator(
        task_id="health_check",
        python_callable=health_check,
    )

    # ===== Generate mock data =====
    generate_data = BashOperator(
        task_id="generate_sample_data",
        bash_command="python -m lakehouse.sources.mock.retail_generator",
    )

    # ===== 🥉 Bronze: Ingest =====
    bronze_ingest = BashOperator(
        task_id="bronze_ingest",
        bash_command="python -m lakehouse.ingest.batch.csv_ingestor",
    )

    # ===== 🥈 Silver: Transform =====
    silver_customers = BashOperator(
        task_id="silver_customers",
        bash_command=(
            "docker exec lake-spark-master spark-submit "
            "--master spark://spark-master:7077 "
            "--packages io.delta:delta-spark_2.12:3.0.0 "
            "/app-src/lakehouse/transform/batch/customers_transformer.py"
        ),
    )
    silver_products = BashOperator(
        task_id="silver_products",
        bash_command=(
            "docker exec lake-spark-master spark-submit "
            "--master spark://spark-master:7077 "
            "--packages io.delta:delta-spark_2.12:3.0.0 "
            "/app-src/lakehouse/transform/batch/products_transformer.py"
        ),
    )
    silver_orders = BashOperator(
        task_id="silver_orders",
        bash_command=(
            "docker exec lake-spark-master spark-submit "
            "--master spark://spark-master:7077 "
            "--packages io.delta:delta-spark_2.12:3.0.0 "
            "/app-src/lakehouse/transform/batch/orders_transformer.py"
        ),
    )

    # ===== 🥇 Gold: Aggregate =====
    gold_fact_orders = BashOperator(
        task_id="gold_fact_orders",
        bash_command=(
            "docker exec lake-spark-master spark-submit "
            "--master spark://spark-master:7077 "
            "--packages io.delta:delta-spark_2.12:3.0.0 "
            "/app-src/lakehouse/aggregate/batch/fact_orders_aggregator.py"
        ),
    )
    gold_dim_customers = BashOperator(
        task_id="gold_dim_customers",
        bash_command=(
            "docker exec lake-spark-master spark-submit "
            "--master spark://spark-master:7077 "
            "--packages io.delta:delta-spark_2.12:3.0.0 "
            "/app-src/lakehouse/aggregate/batch/dim_customers_aggregator.py"
        ),
    )
    gold_dim_products = BashOperator(
        task_id="gold_dim_products",
        bash_command=(
            "docker exec lake-spark-master spark-submit "
            "--master spark://spark-master:7077 "
            "--packages io.delta:delta-spark_2.12:3.0.0 "
            "/app-src/lakehouse/aggregate/batch/dim_products_aggregator.py"
        ),
    )
    gold_daily_revenue = BashOperator(
        task_id="gold_daily_revenue",
        bash_command=(
            "docker exec lake-spark-master spark-submit "
            "--master spark://spark-master:7077 "
            "--packages io.delta:delta-spark_2.12:3.0.0 "
            "/app-src/lakehouse/aggregate/batch/daily_revenue_aggregator.py"
        ),
    )

    # ===== Dependencies =====
    health >> generate_data >> bronze_ingest >> [
        silver_customers,
        silver_products,
        silver_orders,
    ]
    silver_customers >> gold_dim_customers
    silver_products >> gold_dim_products
    [silver_customers, silver_products, silver_orders] >> gold_fact_orders
    silver_orders >> gold_daily_revenue