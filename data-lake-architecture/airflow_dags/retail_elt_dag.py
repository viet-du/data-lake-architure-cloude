"""
Airflow DAG: Retail ELT Pipeline (Batch)
Chạy Bronze → Silver → Gold theo lịch.
"""
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


def health_check(**context):
    """Check MinIO + Spark healthy."""
    import subprocess
    result = subprocess.run(
        ["docker", "exec", "lake-minio", "mc", "ls", "local/"],
        capture_output=True, text=True, timeout=10,
    )
    if result.returncode != 0:
        raise Exception(f"MinIO not healthy: {result.stderr}")
    print("✅ MinIO healthy")
    return "ok"


with DAG(
    dag_id="retail_elt_dag",
    default_args=default_args,
    description="Retail ELT pipeline (Bronze → Silver → Gold)",
    schedule_interval=timedelta(hours=24),
    catchup=False,
    tags=["elt", "batch", "retail"],
) as dag:

    health = PythonOperator(
        task_id="health_check",
        python_callable=health_check,
    )

    generate_data = BashOperator(
        task_id="generate_sample_data",
        bash_command="python /scripts/generate_sample_data.py",
    )

    bronze = BashOperator(
        task_id="bronze_ingest",
        bash_command="python /scripts/01_ingest_to_bronze.py",
    )

    silver = BashOperator(
        task_id="silver_transform",
        bash_command="""
        docker exec lake-spark-master spark-submit \
          --master spark://spark-master:7077 \
          --packages io.delta:delta-spark_2.12:3.0.0 \
          /scripts/02_transform_to_silver.py
        """,
    )

    gold = BashOperator(
        task_id="gold_aggregate",
        bash_command="""
        docker exec lake-spark-master spark-submit \
          --master spark://spark-master:7077 \
          --packages io.delta:delta-spark_2.12:3.0.0 \
          /scripts/03_aggregate_to_gold.py
        """,
    )

    health >> generate_data >> bronze >> silver >> gold
