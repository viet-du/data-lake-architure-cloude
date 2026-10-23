"""Count each Delta table stored under the local MinIO layer buckets."""
from __future__ import annotations

import argparse
import sys

from pyspark.sql import SparkSession


def _delta_table_paths(spark: SparkSession, layer: str) -> list[str]:
    """Find table roots by locating their `_delta_log` directories."""
    jvm = spark.sparkContext._jvm
    conf = spark.sparkContext._jsc.hadoopConfiguration()
    root = jvm.org.apache.hadoop.fs.Path(f"s3a://{layer}/")
    fs = root.getFileSystem(conf)
    ignored = {"_checkpoints", "_delta_log", "_quarantine", "_schemas"}
    found: list[str] = []
    pending = [root]

    while pending:
        current = pending.pop()
        delta_log = jvm.org.apache.hadoop.fs.Path(current, "_delta_log")
        if fs.exists(delta_log):
            found.append(current.toString().rstrip("/"))
            continue

        for status in fs.listStatus(current):
            if not status.isDirectory():
                continue
            name = status.getPath().getName()
            if name in ignored or name.startswith(".") or name.startswith("_"):
                continue
            pending.append(status.getPath())

    return sorted(found)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--layers", nargs="+", choices=("bronze", "silver", "gold"), required=True)
    parser.add_argument("--table", help="match a table by its final path component")
    args = parser.parse_args()

    spark = (
        SparkSession.builder.appName("verify-minio-delta")
        .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
        .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog")
        .config("spark.hadoop.fs.s3a.endpoint", "http://minio:9000")
        .config("spark.hadoop.fs.s3a.access.key", "minioadmin")
        .config("spark.hadoop.fs.s3a.secret.key", "minioadmin")
        .config("spark.hadoop.fs.s3a.path.style.access", "true")
        .config("spark.hadoop.fs.s3a.connection.ssl.enabled", "false")
        .config(
            "spark.hadoop.fs.s3a.aws.credentials.provider",
            "org.apache.hadoop.fs.s3a.SimpleAWSCredentialsProvider",
        )
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel("ERROR")

    total_tables = 0
    try:
        for layer in args.layers:
            paths = _delta_table_paths(spark, layer)
            if args.table:
                paths = [p for p in paths if p.rsplit("/", 1)[-1] == args.table]

            print(f"\n=== {layer.upper()} ===", flush=True)
            if not paths:
                print("  No Delta tables found.", flush=True)
                continue

            for path in paths:
                count = spark.read.format("delta").load(path).count()
                print(f"  {path}: {count} rows", flush=True)
                total_tables += 1

        if args.table and total_tables == 0:
            print(f"No Delta table named {args.table!r} found in selected layer(s).", file=sys.stderr)
            return 1
        return 0
    finally:
        spark.stop()


if __name__ == "__main__":
    raise SystemExit(main())
