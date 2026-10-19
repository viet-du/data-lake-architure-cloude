"""Experiment 02 — fair ETL vs ELT comparison on the same sales input.

Both paths apply the same transformation and produce identical Silver and
Gold schemas. ETL transforms the source before its first Delta write; ELT
persists the source unchanged to Bronze before applying that transformation.
The experiment reports stage timings and active Delta data-file metrics.

Business rule used by this experiment: retain rows with a non-null order ID,
valid order date, and positive total amount; deduplicate by order ID. Order
status is preserved but not filtered, so the reported revenue includes every
status that passes those rules. This makes the experiment reproducible without
silently introducing a new status policy.
"""

from __future__ import annotations

import hashlib
import sys
import time
from pathlib import Path

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from experiments._common import (  # noqa: E402
    build_local_spark,
    delta_table_stats,
    reset_workspace,
    write_results_csv,
)

SAMPLE_PATH = Path("data-samples/erp/orders.json")
SILVER_COLUMNS = [
    "order_id",
    "customer_id",
    "order_date",
    "status",
    "total_amount",
]


def _read_source(spark: SparkSession) -> DataFrame:
    """Read the unchanged source JSON array; apply no business filters here."""
    if not SAMPLE_PATH.exists():
        raise FileNotFoundError(f"{SAMPLE_PATH} not found. Run `make mock-retail` first.")
    return spark.read.json(str(SAMPLE_PATH), multiLine=True)


def _transform_orders(raw: DataFrame) -> DataFrame:
    """Shared cleaning rules for ETL and ELT, yielding the same Silver schema."""
    return (
        raw.withColumn("order_date", F.to_date("order_date"))
        .withColumn("total_amount", F.col("total_amount").cast("double"))
        .filter(F.col("order_id").isNotNull())
        .filter(F.col("order_date").isNotNull())
        .filter(F.col("total_amount").isNotNull() & (F.col("total_amount") > 0))
        .dropDuplicates(["order_id"])
        .select(*SILVER_COLUMNS)
    )


def _aggregate_daily_revenue(silver: DataFrame) -> DataFrame:
    """Shared Gold calculation used by both paths."""
    return silver.groupBy("order_date").agg(
        F.count("*").alias("order_count"),
        F.round(F.sum("total_amount"), 2).alias("revenue"),
        F.countDistinct("customer_id").alias("distinct_customers"),
    )


def _write_delta(df: DataFrame, path: Path, *, partition_by: str | None = None) -> None:
    writer = df.write.format("delta").mode("overwrite")
    if partition_by:
        writer = writer.partitionBy(partition_by)
    writer.save(str(path))


def _timed_write(
    df: DataFrame, path: Path, *, partition_by: str | None = None
) -> float:
    start = time.perf_counter()
    _write_delta(df, path, partition_by=partition_by)
    return time.perf_counter() - start


def _table_metrics(spark: SparkSession, path: Path) -> dict[str, int]:
    return delta_table_stats(spark, path)


def _run_etl(spark: SparkSession, workspace: Path) -> tuple[dict, DataFrame]:
    """Transform source before loading; persist Silver and Gold, with no Bronze."""
    silver_path = workspace / "etl" / "silver"
    gold_path = workspace / "etl" / "gold"

    raw = _read_source(spark)
    t0 = time.perf_counter()
    silver = _transform_orders(raw)
    silver_write_sec = _timed_write(silver, silver_path, partition_by="order_date")
    silver_transform_load_sec = time.perf_counter() - t0

    t0 = time.perf_counter()
    gold = _aggregate_daily_revenue(spark.read.format("delta").load(str(silver_path)))
    gold_write_sec = _timed_write(gold, gold_path)
    gold_sec = time.perf_counter() - t0

    silver_stats = _table_metrics(spark, silver_path)
    gold_stats = _table_metrics(spark, gold_path)
    return (
        {
            "step": "etl",
            "source_rows": raw.count(),
            "silver_rows": spark.read.format("delta").load(str(silver_path)).count(),
            "gold_rows": spark.read.format("delta").load(str(gold_path)).count(),
            "bronze_files": 0,
            "bronze_bytes": 0,
            "silver_files": silver_stats["file_count"],
            "silver_bytes": silver_stats["total_bytes"],
            "gold_files": gold_stats["file_count"],
            "gold_bytes": gold_stats["total_bytes"],
            "silver_transform_load_sec": round(silver_transform_load_sec, 3),
            "silver_write_sec": round(silver_write_sec, 3),
            "gold_sec": round(gold_sec, 3),
            "gold_write_sec": round(gold_write_sec, 3),
            "total_sec": round(silver_transform_load_sec + gold_sec, 3),
            "total_files": silver_stats["file_count"] + gold_stats["file_count"],
            "total_bytes": silver_stats["total_bytes"] + gold_stats["total_bytes"],
        },
        spark.read.format("delta").load(str(gold_path)),
    )


def _run_elt(spark: SparkSession, workspace: Path) -> tuple[dict, DataFrame]:
    """Load unchanged source to Bronze, then run the shared Silver/Gold logic."""
    bronze_path = workspace / "elt" / "bronze"
    silver_path = workspace / "elt" / "silver"
    gold_path = workspace / "elt" / "gold"

    raw = _read_source(spark)
    source_rows = raw.count()
    bronze_sec = _timed_write(raw, bronze_path)
    bronze_stats = _table_metrics(spark, bronze_path)

    t0 = time.perf_counter()
    bronze = spark.read.format("delta").load(str(bronze_path))
    silver = _transform_orders(bronze)
    silver_write_sec = _timed_write(silver, silver_path, partition_by="order_date")
    silver_transform_load_sec = time.perf_counter() - t0

    t0 = time.perf_counter()
    silver_read = spark.read.format("delta").load(str(silver_path))
    gold = _aggregate_daily_revenue(silver_read)
    gold_write_sec = _timed_write(gold, gold_path)
    gold_sec = time.perf_counter() - t0

    silver_stats = _table_metrics(spark, silver_path)
    gold_stats = _table_metrics(spark, gold_path)
    return (
        {
            "step": "elt",
            "source_rows": source_rows,
            "silver_rows": spark.read.format("delta").load(str(silver_path)).count(),
            "gold_rows": spark.read.format("delta").load(str(gold_path)).count(),
            "bronze_files": bronze_stats["file_count"],
            "bronze_bytes": bronze_stats["total_bytes"],
            "silver_files": silver_stats["file_count"],
            "silver_bytes": silver_stats["total_bytes"],
            "gold_files": gold_stats["file_count"],
            "gold_bytes": gold_stats["total_bytes"],
            "bronze_sec": round(bronze_sec, 3),
            "silver_transform_load_sec": round(silver_transform_load_sec, 3),
            "silver_write_sec": round(silver_write_sec, 3),
            "gold_sec": round(gold_sec, 3),
            "gold_write_sec": round(gold_write_sec, 3),
            "total_sec": round(bronze_sec + silver_transform_load_sec + gold_sec, 3),
            "total_files": (
                bronze_stats["file_count"]
                + silver_stats["file_count"]
                + gold_stats["file_count"]
            ),
            "total_bytes": (
                bronze_stats["total_bytes"]
                + silver_stats["total_bytes"]
                + gold_stats["total_bytes"]
            ),
        },
        spark.read.format("delta").load(str(gold_path)),
    )


def _assert_gold_equivalent(etl_gold: DataFrame, elt_gold: DataFrame) -> int:
    """Fail the experiment if either Gold output contains different rows."""
    etl_only = etl_gold.exceptAll(elt_gold).count()
    elt_only = elt_gold.exceptAll(etl_gold).count()
    if etl_only or elt_only:
        raise AssertionError(
            f"ETL/ELT Gold outputs differ: etl_only={etl_only}, elt_only={elt_only}"
        )
    return 0


def main() -> None:
    source_hash = hashlib.sha256(SAMPLE_PATH.read_bytes()).hexdigest()
    source_lines = sum(1 for line in SAMPLE_PATH.open(encoding="utf-8") if line.strip() == "{")
    print(f"Source: {SAMPLE_PATH}; JSON objects: {source_lines}; SHA-256: {source_hash}")
    print("Rule: valid order_id/date, positive total_amount, deduplicate by order_id;")
    print("       preserve all statuses (including cancelled/refunded).")

    spark = build_local_spark("Experiment02-ETLvsELT")
    try:
        # reset_workspace only removes _experiments_workspace/exp02.
        workspace = reset_workspace("exp02")

        print("\n=== ETL (source → shared transform → Silver → Gold) ===")
        etl_result, etl_gold = _run_etl(spark, workspace)
        for key, value in etl_result.items():
            print(f"  {key:30s}: {value}")

        print("\n=== ELT (raw source → Bronze → same Silver → same Gold) ===")
        elt_result, elt_gold = _run_elt(spark, workspace)
        for key, value in elt_result.items():
            print(f"  {key:30s}: {value}")

        _assert_gold_equivalent(etl_gold, elt_gold)
        print("\nGold parity: PASS (bidirectional EXCEPT ALL returned zero rows)")

        delta = {
            "step": "elt_minus_etl",
            "total_sec_delta": round(elt_result["total_sec"] - etl_result["total_sec"], 3),
            "total_bytes_delta": elt_result["total_bytes"] - etl_result["total_bytes"],
            "total_files_delta": elt_result["total_files"] - etl_result["total_files"],
            "gold_mismatch_rows": 0,
        }
        results = [
            {"source_sha256": source_hash, **etl_result},
            {"source_sha256": source_hash, **elt_result},
            delta,
        ]
        out = write_results_csv("02_etl_vs_elt", results)
        print(f"\nResults written to {out}")
    finally:
        spark.stop()


if __name__ == "__main__":
    main()
