"""Crawl public sources, stage raw JSON in a UC Volume, and load Databricks Bronze."""
from __future__ import annotations

import logging
import sys
from datetime import datetime, timedelta
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from airflow import DAG  # noqa: E402
from airflow.exceptions import AirflowSkipException  # noqa: E402
from airflow.operators.bash import BashOperator  # noqa: E402
from airflow.operators.python import PythonOperator  # noqa: E402
from airflow.utils.trigger_rule import TriggerRule  # noqa: E402

from lakehouse.sources.databricks_sink import DatabricksCrawlerSink  # noqa: E402
from lakehouse.sources.minio_crawler_etl_sink import MinioCrawlerEtlSink  # noqa: E402
from lakehouse.sources.scheduler import build_default_scheduler  # noqa: E402

logger = logging.getLogger(__name__)

DEFAULT_ARGS = {
    "owner": "data-platform",
    "depends_on_past": False,
    "retries": 2,
    "retry_delay": timedelta(minutes=5),
    "execution_timeout": timedelta(minutes=15),
    "email_on_failure": False,
}


def _prepare_databricks_lakehouse(**ctx):
    DatabricksCrawlerSink().ensure_lakehouse_tables()


def _crawl_and_stage(job_name: str, **ctx):
    """Crawl once, then fan the same records to MinIO ETL and Databricks ELT."""
    scheduler = build_default_scheduler(kafka_enabled=False)
    job = scheduler.get_job(job_name)
    run_id = f"{ctx['dag'].dag_id}:{ctx['run_id']}"
    try:
        records = job.crawler.crawl(**job.kwargs)
        if not records:
            raise AirflowSkipException(f"Crawler {job_name} returned no records")
        etl_result = MinioCrawlerEtlSink().transform_and_load(
            records,
            source=job_name,
            run_id=run_id,
        )
        elt_result = DatabricksCrawlerSink().stage_and_load(
            records,
            source=job_name,
            run_id=run_id,
        )
        return {"etl_minio": etl_result, "elt_databricks": elt_result}
    finally:
        scheduler.close()


def _transform_and_verify_databricks_lakehouse(**ctx):
    run_id = f"{ctx['dag'].dag_id}:{ctx['run_id']}"
    job_names_by_task = {
        "crawl_tiki_smartphone": "tiki-smartphone",
        "crawl_tiki_laptop": "tiki-laptop",
        "crawl_tiki_fashion": "tiki-fashion",
        "crawl_tiki_beauty": "tiki-beauty",
        "crawl_tiki_home_appliance": "tiki-home-appliance",
        "crawl_github_trending": "github-trending",
        "crawl_hackernews": "hackernews-top",
        "crawl_crypto_top50": "crypto-top-50",
    }
    successful_tasks = {
        task_instance.task_id
        for task_instance in ctx["dag_run"].get_task_instances()
        if task_instance.state == "success"
    }
    successful_sources = [
        job_name
        for task_id, job_name in job_names_by_task.items()
        if task_id in successful_tasks
    ]
    minio_result = MinioCrawlerEtlSink().verify_run(run_id, successful_sources)
    databricks_result = DatabricksCrawlerSink().transform_run(run_id)
    return {"etl_minio": minio_result, "elt_databricks": databricks_result}


with DAG(
    dag_id="crawler_dag",
    description="Crawl once, fan out to MinIO ETL and Databricks ELT, then verify both paths",
    default_args=DEFAULT_ARGS,
    start_date=datetime(2026, 10, 1),
    schedule_interval=timedelta(hours=1),
    catchup=False,
    max_active_runs=1,
    tags=["crawler", "databricks", "bronze"],
) as dag:
    prepare_bronze = PythonOperator(
        task_id="prepare_databricks_lakehouse",
        python_callable=_prepare_databricks_lakehouse,
    )

    crawler_tasks = []
    for task_id, job_name in (
        ("crawl_tiki_smartphone", "tiki-smartphone"),
        ("crawl_tiki_laptop", "tiki-laptop"),
        ("crawl_tiki_fashion", "tiki-fashion"),
        ("crawl_tiki_beauty", "tiki-beauty"),
        ("crawl_tiki_home_appliance", "tiki-home-appliance"),
        ("crawl_github_trending", "github-trending"),
        ("crawl_hackernews", "hackernews-top"),
        ("crawl_crypto_top50", "crypto-top-50"),
    ):
        crawler_tasks.append(
            PythonOperator(
                task_id=task_id,
                python_callable=_crawl_and_stage,
                op_kwargs={"job_name": job_name},
            )
        )

    transform_minio_etl = BashOperator(
        task_id="transform_minio_etl_delta",
        bash_command=(
            "docker exec -e ENV=local -e S3_ENDPOINT= lake-spark-master "
            "spark-submit --master local[1] --driver-memory 512m "
            "--conf spark.executor.memory=512m "
            "/app-src/src/lakehouse/tools/crawler_minio_etl.py "
            "--run-id '{{ dag.dag_id }}:{{ run_id }}'"
        ),
        trigger_rule=TriggerRule.NONE_FAILED_MIN_ONE_SUCCESS,
        execution_timeout=timedelta(minutes=15),
    )

    verify_bronze = PythonOperator(
        task_id="transform_verify_databricks_lakehouse",
        python_callable=_transform_and_verify_databricks_lakehouse,
        trigger_rule=TriggerRule.NONE_FAILED_MIN_ONE_SUCCESS,
    )

    # Avoid bursts against Tiki's public endpoint: run the category crawls in
    # sequence, while unrelated sources can still run concurrently. If one
    # Tiki category has no results, continue with the next category.
    tiki_tasks = crawler_tasks[:5]
    other_source_tasks = crawler_tasks[5:]
    prepare_bronze >> tiki_tasks[0]
    for previous, current in zip(tiki_tasks, tiki_tasks[1:]):
        current.trigger_rule = TriggerRule.NONE_FAILED
        previous >> current
    prepare_bronze >> other_source_tasks
    [tiki_tasks[-1], *other_source_tasks] >> transform_minio_etl >> verify_bronze
