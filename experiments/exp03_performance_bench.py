"""Experiment 03 — Performance benchmark: ingest, transform, query.  # noqa: N999

Rubric line addressed:
  "Đo thời gian ingest, transform, query, dung lượng và số tệp trước-sau tối ưu."

What this script measures (on a single-machine Delta table, no Kafka):
  1.  ``ingest`` — read ``data-samples/erp/orders.json`` and write Bronze.
  2.  ``transform`` — read Bronze, clean + dedup, write Silver.
  3.  ``aggregate`` — read Silver, build Gold daily_revenue, write Gold.
  4.  ``query`` — read Gold and run 3 representative SQL queries.
  5.  ``optimize`` — run ``OPTIMIZE`` then re-measure active data-file
      count + bytes, excluding Delta transaction logs.
  6.  ``partition_pruning`` — read a single ``order_date`` partition and
      measure the time difference vs a full scan.

All measurements are recorded with wall-clock seconds and reported to
``results/03_performance_bench.csv``.
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

from pyspark.sql import SparkSession
from pyspark.sql import functions as F

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from experiments._common import (  # noqa: E402
    build_local_spark,
    delta_table_stats,
    reset_workspace,
    write_results_csv,
)

SAMPLE_ORDERS = Path("data-samples/erp/orders.json")
SAMPLE_PRODUCTS = Path("data-samples/erp/products.csv")


def _ingest_bronze(spark: SparkSession, bronze_path: Path) -> tuple[float, dict]:
    df = spark.read.json(str(SAMPLE_ORDERS), multiLine=True)
    df = df.withColumn("_ingestion_date", F.current_date().cast("string"))
    t0 = time.perf_counter()
    (
        df.write.format("delta")
        .mode("overwrite")
        .partitionBy("_ingestion_date")
        .save(str(bronze_path))
    )
    elapsed = time.perf_counter() - t0
    return elapsed, delta_table_stats(spark, bronze_path)


def _transform_silver(
    spark: SparkSession, bronze_path: Path, silver_path: Path
) -> tuple[float, dict]:
    bronze = spark.read.format("delta").load(str(bronze_path))
    cleaned = (
        bronze.withColumn("order_date", F.to_date("order_date"))
        .withColumn("total_amount", F.col("total_amount").cast("double"))
        .filter(F.col("order_id").isNotNull())
        .filter(F.col("total_amount") > 0)
        .dropDuplicates(["order_id"])
    )
    t0 = time.perf_counter()
    (
        cleaned.write.format("delta")
        .mode("overwrite")
        .partitionBy("order_date")
        .save(str(silver_path))
    )
    elapsed = time.perf_counter() - t0
    return elapsed, delta_table_stats(spark, silver_path)


def _aggregate_gold(spark: SparkSession, silver_path: Path, gold_path: Path) -> tuple[float, dict]:
    silver = spark.read.format("delta").load(str(silver_path))
    gold = silver.groupBy("order_date").agg(
        F.count("*").alias("order_count"),
        F.round(F.sum("total_amount"), 2).alias("revenue"),
        F.countDistinct("customer_id").alias("distinct_customers"),
    )
    t0 = time.perf_counter()
    # Seed small files so the OPTIMIZE measurement has files to compact.
    gold.repartition(4).write.format("delta").mode("overwrite").save(str(gold_path))
    elapsed = time.perf_counter() - t0
    return elapsed, delta_table_stats(spark, gold_path)


def _query_benchmarks(spark: SparkSession, gold_path: Path) -> dict:
    gold = spark.read.format("delta").load(str(gold_path)).cache()
    gold.count()  # materialize cache

    t0 = time.perf_counter()
    q1 = spark.sql(f"SELECT * FROM delta.`{gold_path}` ORDER BY revenue DESC LIMIT 5").collect()
    q1_time = time.perf_counter() - t0

    t0 = time.perf_counter()
    q2 = spark.sql(
        f"SELECT order_date, revenue FROM delta.`{gold_path}` "
        f"WHERE order_date BETWEEN '2026-01-01' AND '2026-03-31' ORDER BY order_date"
    ).collect()
    q2_time = time.perf_counter() - t0

    t0 = time.perf_counter()
    q3 = spark.sql(
        f"SELECT order_date, revenue FROM delta.`{gold_path}` " f"WHERE order_date = '2026-02-15'"
    ).collect()
    q3_time = time.perf_counter() - t0

    return {
        "step": "queries",
        "q1_top5_revenue_sec": round(q1_time, 4),
        "q2_q1_range_count": len(q2),
        "q2_q1_range_sec": round(q2_time, 4),
        "q3_single_day_count": len(q3),
        "q3_single_day_sec": round(q3_time, 4),
        "q1_top5_first_row": str(q1[0].asDict()) if q1 else "<empty>",
    }


def _optimize_bench(spark: SparkSession, gold_path: Path) -> dict:
    before = delta_table_stats(spark, gold_path)
    t0 = time.perf_counter()
    spark.sql(f"OPTIMIZE delta.`{gold_path}`").collect()
    elapsed = time.perf_counter() - t0
    after = delta_table_stats(spark, gold_path)
    return {
        "step": "optimize",
        "optimize_time_sec": round(elapsed, 3),
        "files_before": before["file_count"],
        "files_after": after["file_count"],
        "bytes_before": before["total_bytes"],
        "bytes_after": after["total_bytes"],
        "files_delta": after["file_count"] - before["file_count"],
    }


def _partition_pruning_bench(spark: SparkSession, silver_path: Path) -> dict:
    silver = spark.read.format("delta").load(str(silver_path))
    # Find any single partition date
    one_day = (
        silver.select("order_date")
        .filter(F.col("order_date").isNotNull())
        .limit(1)
        .first()["order_date"]
    )
    t0 = time.perf_counter()
    single = silver.filter(F.col("order_date") == one_day).count()
    t_single = time.perf_counter() - t0
    t0 = time.perf_counter()
    total = silver.count()
    t_full = time.perf_counter() - t0
    return {
        "step": "partition_pruning",
        "single_partition_day": str(one_day),
        "single_partition_rows": single,
        "single_partition_sec": round(t_single, 4),
        "full_scan_rows": total,
        "full_scan_sec": round(t_full, 4),
        "speedup_x": round(t_full / t_single, 2) if t_single > 0 else None,
    }


def main() -> None:
    if not SAMPLE_ORDERS.exists() or not SAMPLE_PRODUCTS.exists():
        raise FileNotFoundError(
            "data-samples/erp/orders.json (or products.csv) missing — "
            "run `make mock-retail` first."
        )
    spark = build_local_spark("Experiment03-PerformanceBench")
    try:
        results: list[dict] = []
        workspace = reset_workspace("exp03")
        bronze_path = workspace / "bronze"
        silver_path = workspace / "silver"
        gold_path = workspace / "gold"

        print("=== 1. Ingest (orders.json → Bronze) ===")
        t_ingest, s_ingest = _ingest_bronze(spark, bronze_path)
        print(f"  done in {t_ingest:.3f}s, files={s_ingest['file_count']}")
        results.append(
            {
                "step": "ingest",
                "wall_time_sec": round(t_ingest, 3),
                **s_ingest,
            }
        )

        print("=== 2. Transform (Bronze → Silver) ===")
        t_silver, s_silver = _transform_silver(spark, bronze_path, silver_path)
        print(f"  done in {t_silver:.3f}s, files={s_silver['file_count']}")
        results.append({"step": "transform", "wall_time_sec": round(t_silver, 3), **s_silver})

        print("=== 3. Aggregate (Silver → Gold) ===")
        t_gold, s_gold = _aggregate_gold(spark, silver_path, gold_path)
        print(f"  done in {t_gold:.3f}s, files={s_gold['file_count']}")
        results.append({"step": "aggregate", "wall_time_sec": round(t_gold, 3), **s_gold})

        print("=== 4. Query benchmark ===")
        q_res = _query_benchmarks(spark, gold_path)
        for k, v in q_res.items():
            print(f"  {k}: {v}")
        results.append(q_res)

        print("=== 5. OPTIMIZE benchmark ===")
        opt_res = _optimize_bench(spark, gold_path)
        for k, v in opt_res.items():
            print(f"  {k}: {v}")
        results.append(opt_res)

        print("=== 6. Partition pruning benchmark ===")
        prune_res = _partition_pruning_bench(spark, silver_path)
        for k, v in prune_res.items():
            print(f"  {k}: {v}")
        results.append(prune_res)

        out = write_results_csv("03_performance_bench", results)
        print(f"\nResults written to {out}")
        print("PASS — experiment 03 completed all 6 measurements.")
    finally:
        spark.stop()


if __name__ == "__main__":
    main()
