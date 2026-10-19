from __future__ import annotations

from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.bash import BashOperator

from lakehouse.core.constants import DELTA_PACKAGE, KAFKA_PACKAGE

default_args = {
    "owner": "data-engineering",
    "depends_on_past": False,
    "start_date": datetime(2024, 1, 1),
    "email_on_failure": False,
    "retries": 0,
}


with DAG(
    dag_id="ecommerce_streaming_dag",
    default_args=default_args,
    description="E-commerce streaming pipeline (Bronze→Silver→Gold)",
    schedule_interval=timedelta(hours=1),
    catchup=False,
    tags=["streaming", "ecommerce"],
) as dag:
    stream_pipeline = BashOperator(
        task_id="run_ecommerce_pipeline",
        bash_command=(
            "docker exec "
            "-e KAFKA_BOOTSTRAP=kafka:29092 "
            "-e MINIO_ENDPOINT=minio:9000 "
            "-e AWS_ACCESS_KEY_ID=minioadmin "
            "-e AWS_SECRET_ACCESS_KEY=minioadmin "
            "lake-spark-master spark-submit "
            "--master spark://spark-master:7077 "
            f"--packages {KAFKA_PACKAGE},{DELTA_PACKAGE} "
            "/app-src/src/lakehouse/pipelines/stream_ecommerce.py"
        ),
        execution_timeout=timedelta(hours=2),
    )