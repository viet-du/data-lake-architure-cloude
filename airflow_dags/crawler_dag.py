"""
DAG: crawler_dag
================
Automated multi-source data collection.

Runs `CrawlScheduler` jobs at their configured intervals using Airflow
as the orchestration layer (retries, alerting, SLA monitoring).

Schedule:
  - Tiki e-commerce:    every 6h  (smartphone, laptop, fashion, beauty, home-appliance)
  - GitHub trending:    every 1h
  - HackerNews top:     every 30min
  - Crypto top-50:      every 5min
  - Weather 3 cities:   every 30min

Each task produces events to Kafka topics:
  - ecommerce-products-stream
  - ecommerce-reviews-stream
  - github-trending-stream
  - hackernews-stream
  - crypto-prices-stream
  - weather-stream

Spark streaming pipelines downstream (in `streaming_dag`) consume
these topics and write to Bronze Delta tables.
"""
from __future__ import annotations

import logging
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Make src/ importable when Airflow loads this DAG
PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from airflow import DAG  # noqa: E402
from airflow.operators.python import PythonOperator  # noqa: E402

from lakehouse.sources.scheduler import (  # noqa: E402
    CrawlJob,
    CrawlScheduler,
    build_default_scheduler,
)

logger = logging.getLogger(__name__)

DEFAULT_ARGS = {
    "owner": "data-platform",
    "depends_on_past": False,
    "retries": 2,
    "retry_delay": timedelta(minutes=5),
    "execution_timeout": timedelta(minutes=15),
    "email_on_failure": False,
}


def _crawl_tiki_smartphone(**ctx):
    sched = build_default_scheduler()
    return sched.run_once("tiki-smartphone")


def _crawl_tiki_laptop(**ctx):
    sched = build_default_scheduler()
    return sched.run_once("tiki-laptop")


def _crawl_tiki_fashion(**ctx):
    sched = build_default_scheduler()
    return sched.run_once("tiki-fashion")


def _crawl_tiki_beauty(**ctx):
    sched = build_default_scheduler()
    return sched.run_once("tiki-beauty")


def _crawl_tiki_home(**ctx):
    sched = build_default_scheduler()
    return sched.run_once("tiki-home-appliance")


def _crawl_github_trending(**ctx):
    sched = build_default_scheduler()
    return sched.run_once("github-trending")


def _crawl_hackernews_top(**ctx):
    sched = build_default_scheduler()
    return sched.run_once("hackernews-top")


def _crawl_crypto_top50(**ctx):
    sched = build_default_scheduler()
    return sched.run_once("crypto-top-50")


def _crawl_weather_hcm(**ctx):
    sched = build_default_scheduler()
    return sched.run_once("weather-ho-chi-minh-city")


def _crawl_weather_hn(**ctx):
    sched = build_default_scheduler()
    return sched.run_once("weather-hanoi")


def _crawl_weather_dn(**ctx):
    sched = build_default_scheduler()
    return sched.run_once("weather-da-nang")


with DAG(
    dag_id="crawler_dag",
    description="Automated multi-source data collection (Tiki, GitHub, HN, Crypto, Weather)",
    default_args=DEFAULT_ARGS,
    start_date=datetime(2026, 10, 1),
    schedule_interval=timedelta(hours=1),
    catchup=False,
    max_active_runs=1,
    tags=["crawler", "ecommerce", "tiki", "kafka"],
) as dag:

    # --- E-commerce: Tiki (5 categories) ---
    tiki_smartphone = PythonOperator(
        task_id="crawl_tiki_smartphone",
        python_callable=_crawl_tiki_smartphone,
    )
    tiki_laptop = PythonOperator(
        task_id="crawl_tiki_laptop",
        python_callable=_crawl_tiki_laptop,
    )
    tiki_fashion = PythonOperator(
        task_id="crawl_tiki_fashion",
        python_callable=_crawl_tiki_fashion,
    )
    tiki_beauty = PythonOperator(
        task_id="crawl_tiki_beauty",
        python_callable=_crawl_tiki_beauty,
    )
    tiki_home = PythonOperator(
        task_id="crawl_tiki_home",
        python_callable=_crawl_tiki_home,
    )

    # --- Trending: GitHub (1h) ---
    github_trending = PythonOperator(
        task_id="crawl_github_trending",
        python_callable=_crawl_github_trending,
    )

    # --- HackerNews (30min) ---
    hackernews = PythonOperator(
        task_id="crawl_hackernews",
        python_callable=_crawl_hackernews_top,
    )

    # --- Crypto (5min) ---
    crypto = PythonOperator(
        task_id="crawl_crypto_top50",
        python_callable=_crawl_crypto_top50,
    )

    # --- Weather (3 cities, 30min) ---
    weather_hcm = PythonOperator(
        task_id="crawl_weather_hcm",
        python_callable=_crawl_weather_hcm,
    )
    weather_hn = PythonOperator(
        task_id="crawl_weather_hn",
        python_callable=_crawl_weather_hn,
    )
    weather_dn = PythonOperator(
        task_id="crawl_weather_dn",
        python_callable=_crawl_weather_dn,
    )

    # All tasks are independent and run in parallel
    # (no upstream/downstream dependencies between different sources)
    [tiki_smartphone, tiki_laptop, tiki_fashion, tiki_beauty, tiki_home,
     github_trending, hackernews, crypto,
     weather_hcm, weather_hn, weather_dn]
