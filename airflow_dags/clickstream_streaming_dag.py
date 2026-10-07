from __future__ import annotations

from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.bash import BashOperator

default_args = {
    "owner": "data-engineering",
    "depends_on_past": False,
    "start_date": datetime(2024, 1, 1),
    "email_on_failure": False,
    "retries": 0,
}


with DAG(
    dag_id="clickstream_streaming_dag",
    default_args=default_args,
    description="Clickstream streaming pipeline (Bronze→Silver→Gold)",
    schedule_interval=timedelta(hours=1),
    catchup=False,
    tags=["streaming", "clickstream"],
) as dag:
    stream_pipeline = BashOperator(
        task_id="run_clickstream_pipeline",
        bash_command=(
            "docker exec lake-spark-master spark-submit "
            "--master spark://spark-master:7077 "
            "--packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.4.0,"
            "io.delta:delta-spark_2.12:3.0.0 "
            "/app-src/lakehouse/pipelines/stream_clickstream.py"
        ),
        execution_timeout=timedelta(hours=2),
    )