"""Transform staged crawler JSONL into MinIO Delta Silver and Gold tables."""
from __future__ import annotations

import argparse
import logging
import re
from typing import Any

from delta.tables import DeltaTable
from pyspark.sql import SparkSession, functions as F

from lakehouse.core.paths import LakePaths
from lakehouse.core.spark import get_spark_session

logger = logging.getLogger(__name__)


def _safe_run_id(run_id: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]+", "_", run_id).strip("_")[-100:]


def _merge_delta(spark: SparkSession, data: Any, path: str, keys: list[str]) -> None:
    if not DeltaTable.isDeltaTable(spark, path):
        data.write.format("delta").mode("overwrite").partitionBy("source").save(path)
        return
    condition = " AND ".join(f"target.`{key}` = source.`{key}`" for key in keys)
    (
        DeltaTable.forPath(spark, path)
        .alias("target")
        .merge(data.alias("source"), condition)
        .whenMatchedUpdateAll()
        .whenNotMatchedInsertAll()
        .execute()
    )


def transform_run(run_id: str, *, spark: SparkSession | None = None) -> dict[str, Any]:
    spark = spark or get_spark_session("CrawlerMinioETL", master="local[1]")
    paths = LakePaths()
    input_path = f"{paths.silver('crawler_records')}{_safe_run_id(run_id)}/*.jsonl"
    raw = spark.read.json(input_path)
    if raw.limit(1).count() == 0:
        raise RuntimeError(f"No staged MinIO crawler rows found for run {run_id!r}")

    silver = (
        raw.withColumn("payload", F.col("payload").cast("string"))
        .withColumn(
            "record_hash",
            F.sha2(F.concat_ws("||", "source", "record_id", "payload"), 256),
        )
        .dropDuplicates(["run_id", "source", "record_hash"])
    )
    silver_path = paths.silver("crawler_records_delta")
    _merge_delta(spark, silver, silver_path, ["run_id", "source", "record_hash"])

    gold = (
        silver.withColumn("_crawl_ts", F.to_timestamp("crawled_at"))
        .groupBy(
            "run_id", "source", "event_type", F.to_date("_crawl_ts").alias("crawl_date")
        )
        .agg(
            F.count("*").alias("record_count"),
            F.countDistinct("record_id").alias("distinct_records"),
            F.min("_crawl_ts").alias("earliest_crawl"),
            F.max("_crawl_ts").alias("latest_crawl"),
        )
        .withColumn("ingested_at", F.current_timestamp())
    )
    gold_path = paths.gold("crawler_source_metrics_delta")
    _merge_delta(spark, gold, gold_path, ["run_id", "source", "event_type", "crawl_date"])

    silver_count = silver.count()
    gold_count = gold.count()
    verified_silver = (
        spark.read.format("delta").load(silver_path).filter(F.col("run_id") == run_id).count()
    )
    verified_gold = (
        spark.read.format("delta").load(gold_path).filter(F.col("run_id") == run_id).count()
    )
    if verified_silver != silver_count or verified_gold != gold_count:
        raise RuntimeError(
            "MinIO Delta verification failed: "
            f"expected Silver={silver_count}, Gold={gold_count}; "
            f"found Silver={verified_silver}, Gold={verified_gold}"
        )
    result = {
        "run_id": run_id,
        "silver_rows": silver_count,
        "gold_rows": gold_count,
        "silver_delta_path": silver_path,
        "gold_delta_path": gold_path,
    }
    logger.info("Verified MinIO crawler ETL Delta outputs: %s", result)
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-id", required=True)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    spark = get_spark_session("CrawlerMinioETL", master="local[1]")
    try:
        transform_run(args.run_id, spark=spark)
    finally:
        spark.stop()


if __name__ == "__main__":
    main()
