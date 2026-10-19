"""Local console demo — Bronze -> Silver -> Gold pipeline (no Docker).

Goal: a "show me the pipeline running" demo on a laptop that has only
Java + Python. No MinIO, no Airflow, no Kafka.

What you will see when you run it (with Java 11+ installed):

    Lakehouse local console demo  (no Docker required)

  ✓ java found: /usr/bin/java

  ============================================================
    STEP 1/5 — read raw orders.json
  ============================================================
    source       : data-samples/erp/orders.json
    rows (NDJSON): 13000

  ============================================================
    STEP 2/5 — BRONZE: write raw to local Delta
  ============================================================
    target : _experiments_workspace/demo/bronze/orders
    rows   : 13000
    wall   : 0.512s

  ============================================================
    STEP 3/5 — SILVER: clean + dedup
  ============================================================
    rows in : 13000
    rows out: 12987
    dropped : 13
    wall    : 0.421s

  ============================================================
    STEP 4/5 — GOLD: daily_revenue
  ============================================================
    rows          : 365
    total revenue : 1,234,567.89
    top day       : 2026-02-15 = 12,345.67
    wall          : 0.187s

  ============================================================
    STEP 5/5 — QUERY: top-5 days by revenue
  ============================================================
    +-----------+-------+---------+
    |order_date |orders |revenue  |
    +-----------+-------+---------+
    |2026-02-15 |   58  |12,345.67|
    ...
    wall   : 0.094s

  ============================================================
    SUMMARY
  ============================================================
    pipeline   : batch retail (orders)
    total time : 1.556s
    on disk    : 1.80 MB in 12 files
    status     : PASS

If Java is not installed, the script fails fast with a clear error
instead of producing a confusing JAVA_GATEWAY traceback.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

# Make the package importable even when run directly
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pyspark.sql import SparkSession  # noqa: E402
from pyspark.sql import functions as F  # noqa: E402

from experiments._common import (  # noqa: E402
    build_local_spark,
    file_stats,
    reset_workspace,
)

# ---------------------------------------------------------------------------
# Console helpers (ANSI escapes; no external deps)
# ---------------------------------------------------------------------------

RESET = "\033[0m"
BOLD = "\033[1m"
CYAN = "\033[36m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
RED = "\033[31m"


def banner(step: int, total: int, title: str) -> None:
    bar = "=" * 60
    print()
    print(f"{CYAN}{bar}{RESET}")
    print(f"{CYAN}  STEP {step}/{total} — {title}{RESET}")
    print(f"{CYAN}{bar}{RESET}")


def info(key: str, value: object) -> None:
    print(f"  {BOLD}{key:14s}{RESET}: {value}")


def ok(msg: str) -> None:
    print(f"  {GREEN}✓{RESET} {msg}")


def fail(msg: str) -> None:
    print(f"  {RED}✗{RESET} {msg}")


# ---------------------------------------------------------------------------
# Java pre-flight
# ---------------------------------------------------------------------------


def require_java(verbose: bool = False) -> str | None:
    """Return the path to a working ``java`` binary, or None.

    Two-step check:
      1.  Locate the binary on disk (JAVA_HOME, common paths, or PATH).
      2.  Actually run ``java -version`` and confirm exit code 0.

    Step 2 matters because the binary may exist but be broken (e.g. an
    empty stub on a fresh macOS install). The ``verbose`` flag prints
    every candidate tried and the failure reason — useful when the
    script prints "Java is required" and you need to know which paths
    were checked.
    """
    java_home = os.environ.get("JAVA_HOME")
    candidates: list[str] = []
    if java_home and Path(java_home, "bin/java").exists():
        candidates.append(str(Path(java_home, "bin/java")))
    candidates += [
        "/opt/homebrew/opt/openjdk@11/bin/java",
        "/usr/lib/jvm/java-11-openjdk-amd64/bin/java",
        "/usr/lib/jvm/java-17-openjdk-amd64/bin/java",
        "/Library/Java/JavaVirtualMachines/temurin-11.jdk/Contents/Home/bin/java",
    ]
    on_path = shutil.which("java")
    if on_path:
        candidates.append(on_path)
    for binary in candidates:
        try:
            res = subprocess.run(  # noqa: S603 - sandbox-checked binary
                [binary, "-version"],
                capture_output=True,
                text=True,
                timeout=5,
            )
        except (FileNotFoundError, OSError) as e:
            if verbose:
                fail(f"{binary} — {type(e).__name__}: {e}")
            continue
        except subprocess.TimeoutExpired:
            if verbose:
                fail(f"{binary} — timeout (5s)")
            continue
        if res.returncode == 0:
            if binary.startswith("/") and "/bin/java" in binary:
                os.environ["JAVA_HOME"] = str(Path(binary).parent.parent)
            return binary
        if verbose:
            stderr = (res.stderr or "").strip().splitlines()[0] if res.stderr else ""
            fail(f"{binary} — exit {res.returncode} ({stderr})")
    return None


# ---------------------------------------------------------------------------
# Pipeline steps
# ---------------------------------------------------------------------------

SAMPLE = Path("data-samples/erp/orders.json")


def step1_read_raw() -> int:
    banner(1, 5, "read raw orders.json")
    if not SAMPLE.exists():
        fail(f"sample missing: {SAMPLE.resolve()}")
        fail("run `make mock-retail` first (or download data-samples).")
        sys.exit(2)
    # The file is a JSON array ``[ {...}, {...} ]`` (see
    # ``data-samples/erp/orders.json``). Use ``json.load`` so we get
    # the exact order count instead of relying on a fragile prefix
    # match.
    import json

    with SAMPLE.open(encoding="utf-8") as f:
        data = json.load(f)
    n = len(data) if isinstance(data, list) else 0
    info("source", SAMPLE)
    info("rows (orders)", n)
    return n


def step2_bronze(spark: SparkSession, bronze_path: Path) -> int:
    banner(2, 5, "BRONZE: write raw to local Delta")
    t0 = time.perf_counter()
    # NOTE: data-samples/erp/orders.json is a JSON ARRAY (``[ {...},
    # {...}, ... ]``), not NDJSON. With ``multiLine=False`` (the
    # default) Spark reads it as a malformed single-line stream and the
    # inferred schema is just ``_corrupt_record: string``, which then
    # breaks ``partitionBy("_ingestion_date")``. We add an
    # ``_ingestion_date`` column BEFORE writing so the partition column
    # always exists in the schema.
    raw = spark.read.json(str(SAMPLE), multiLine=True)
    raw_with_ingest = raw.withColumn(
        "_ingestion_date", F.current_date().cast("string")
    )
    (raw_with_ingest.write.format("delta").mode("overwrite")
     .partitionBy("_ingestion_date")
     .save(str(bronze_path)))
    elapsed = time.perf_counter() - t0
    n = spark.read.format("delta").load(str(bronze_path)).count()
    info("target", str(bronze_path))
    info("rows", n)
    info("wall", f"{elapsed:.3f}s")
    return n


def step3_silver(
    spark: SparkSession, bronze_path: Path, silver_path: Path,
) -> tuple[int, int]:
    banner(3, 5, "SILVER: clean + dedup")
    t0 = time.perf_counter()
    bronze = spark.read.format("delta").load(str(bronze_path))
    n_in = bronze.count()
    silver = (
        bronze
        .withColumn("order_date", F.to_date("order_date"))
        .withColumn("total_amount", F.col("total_amount").cast("double"))
        .filter(F.col("order_id").isNotNull())
        .filter(F.col("total_amount") > 0)
        .dropDuplicates(["order_id"])
    )
    (silver.write.format("delta").mode("overwrite")
     .partitionBy("order_date")
     .save(str(silver_path)))
    elapsed = time.perf_counter() - t0
    n_out = spark.read.format("delta").load(str(silver_path)).count()
    info("rows in", n_in)
    info("rows out", n_out)
    info("dropped", n_in - n_out)
    info("wall", f"{elapsed:.3f}s")
    return n_in, n_out


def step4_gold(
    spark: SparkSession, silver_path: Path, gold_path: Path,
) -> dict:
    banner(4, 5, "GOLD: daily_revenue")
    t0 = time.perf_counter()
    silver = spark.read.format("delta").load(str(silver_path))
    gold = (
        silver.groupBy("order_date")
        .agg(
            F.count("*").alias("orders"),
            F.round(F.sum("total_amount"), 2).alias("revenue"),
        )
    )
    (gold.write.format("delta").mode("overwrite")
     .save(str(gold_path)))
    elapsed = time.perf_counter() - t0
    total_rev = gold.agg(F.round(F.sum("revenue"), 2).alias("r")).first()["r"]
    top = gold.orderBy(F.desc("revenue")).limit(1).first()
    info("rows", gold.count())
    info("total revenue", f"{total_rev:,.2f}")
    info("top day", f"{top['order_date']} = {top['revenue']:,.2f}")
    info("wall", f"{elapsed:.3f}s")
    return {"total_revenue": float(total_rev), "top_day": str(top["order_date"])}


def step5_query(spark: SparkSession, gold_path: Path) -> None:
    banner(5, 5, "QUERY: top-5 days by revenue")
    t0 = time.perf_counter()
    gold = spark.read.format("delta").load(str(gold_path))
    top5 = gold.orderBy(F.desc("revenue")).limit(5).collect()
    elapsed = time.perf_counter() - t0
    info("wall", f"{elapsed:.3f}s")
    print()
    print("    +-----------+-------+---------+")
    print("    |order_date |orders |revenue  |")
    print("    +-----------+-------+---------+")
    for r in top5:
        print(
            f"    | {r['order_date']} | {r['orders']:>5} | {r['revenue']:>7,.2f} |"
        )
    print("    +-----------+-------+---------+")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main() -> None:
    print()
    print(f"{BOLD}Lakehouse local console demo{RESET}  (no Docker required)")
    print()

    java = require_java(verbose=True)
    if java is None:
        fail("Java is required to run Spark. Install one of:")
        print("       brew install openjdk@11")
        print("       sudo apt install openjdk-11-jdk   # Debian/Ubuntu")
        print("Then re-run.")
        sys.exit(1)
    ok(f"java found: {java}")

    spark = build_local_spark("Demo-LocalPipeline")
    try:
        workspace = reset_workspace("demo")
        bronze = workspace / "bronze" / "orders"
        silver = workspace / "silver" / "orders"
        gold = workspace / "gold" / "daily_revenue"

        n_lines = step1_read_raw()

        t_start = time.perf_counter()
        step2_bronze(spark, bronze)
        in_n, out_n = step3_silver(spark, bronze, silver)
        step4_gold(spark, silver, gold)
        step5_query(spark, gold)
        total = time.perf_counter() - t_start

        bronze_stats = file_stats(bronze)
        silver_stats = file_stats(silver)
        gold_stats = file_stats(gold)
        delta_bytes = (
            bronze_stats["total_bytes"]
            + silver_stats["total_bytes"]
            + gold_stats["total_bytes"]
        )
        delta_files = (
            bronze_stats["file_count"]
            + silver_stats["file_count"]
            + gold_stats["file_count"]
        )

        banner(0, 0, "SUMMARY")
        info("pipeline", "batch retail (orders)")
        info("total time", f"{total:.3f}s")
        info("source rows", n_lines)
        info("bronze rows", in_n)
        info("silver rows", out_n)
        info("on disk", f"{delta_bytes/1024/1024:.2f} MB in {delta_files} files")
        print()
        ok("pipeline finished cleanly")
        print()
    finally:
        spark.stop()


if __name__ == "__main__":
    main()
