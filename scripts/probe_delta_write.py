"""PHASE 1 feasibility probe: PySpark -> MinIO -> Delta write, then DuckDB read-back.

Verifies the ONLY viable Delta write path in this repo (DuckDB delta ext is read-only),
and proves the cross-engine contract: Spark writes Delta, DuckDB reads it.
"""
from __future__ import annotations

import os
import subprocess
import sys
import traceback

os.environ.setdefault("ENV", "local")
os.environ["S3_ENDPOINT"] = "http://127.0.0.1:19000"
os.environ["S3_ACCESS_KEY"] = "minioadmin"
os.environ["S3_SECRET_KEY"] = "minioadmin"
os.environ["S3_REGION"] = "us-east-1"
os.environ["S3_USE_SSL"] = "false"
os.environ["S3_PATH_STYLE_ACCESS"] = "true"
os.environ["SPARK_DRIVER_MEMORY"] = "1g"
os.environ["SPARK_EXECUTOR_MEMORY"] = "1g"

from delta import configure_spark_with_delta_pip  # noqa: E402
from pyspark.sql import SparkSession  # noqa: E402

TARGET = "s3a://lakehouse/_probe/bronze/qa/probe"
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def build_spark() -> SparkSession:
    builder = (
        SparkSession.builder.appName("DeltaWriteProbe")
        .master("local[2]")
        .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
        .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog")
        .config("spark.databricks.delta.schema.autoMerge.enabled", "true")
        .config("spark.driver.memory", "1g")
        .config("spark.hadoop.fs.s3a.endpoint", "127.0.0.1:19000")
        .config("spark.hadoop.fs.s3a.endpoint.region", "us-east-1")
        .config("spark.hadoop.fs.s3a.access.key", "minioadmin")
        .config("spark.hadoop.fs.s3a.secret.key", "minioadmin")
        .config("spark.hadoop.fs.s3a.path.style.access", "true")
        .config("spark.hadoop.fs.s3a.connection.ssl.enabled", "false")
        .config("spark.hadoop.fs.s3a.aws.credentials.provider",
                "org.apache.hadoop.fs.s3a.SimpleAWSCredentialsProvider")
        .config("spark.hadoop.fs.s3a.impl", "org.apache.hadoop.fs.s3a.S3AFileSystem")
    )
    spark = configure_spark_with_delta_pip(
        builder,
        extra_packages=[
            "org.apache.hadoop:hadoop-aws:3.3.4",
            "com.amazonaws:aws-java-sdk-bundle:1.12.262",
        ],
    ).getOrCreate()
    spark.sparkContext.setLogLevel("ERROR")
    return spark


def main() -> int:
    spark = build_spark()
    print("STEP1 spark session ready", flush=True)

    df = spark.createDataFrame(
        [(1, "a", 10.5), (2, "b", 20.25), (3, None, None)],
        ["id", "name", "amount"],
    )
    print("STEP2 dataframe built rows=%d" % df.count(), flush=True)

    (df.write.format("delta").mode("overwrite").option("mergeSchema", "true").save(TARGET))
    print("STEP3 delta write OK -> %s" % TARGET, flush=True)

    # History via the DeltaTable API (DataFrame.history() does not exist in PySpark).
    from delta.tables import DeltaTable

    dt = DeltaTable.forPath(spark, TARGET)
    hist = dt.history()
    print("STEP4 delta history: %s" % [(h.version, h.operation) for h in hist], flush=True)

    out = spark.read.format("delta").load(TARGET).collect()
    print("STEP5 read-back rows=%d data=%s" % (len(out), [r.asDict() for r in out]), flush=True)

    df2 = spark.createDataFrame([(4, "d", 40.0)], ["id", "name", "amount"])
    df2.write.format("delta").mode("append").save(TARGET)
    cnt = spark.read.format("delta").load(TARGET).count()
    print("STEP6 append OK total_rows=%d (expect 4)" % cnt, flush=True)

    df.write.format("delta").mode("overwrite").save(TARGET)
    cnt2 = spark.read.format("delta").load(TARGET).count()
    print("STEP7 overwrite OK rows=%d (expect 3)" % cnt2, flush=True)

    hist2 = DeltaTable.forPath(spark, TARGET).history()
    print("STEP8 final history versions=%s" % [h.version for h in hist2], flush=True)

    spark.stop()
    print("STEP9 spark stopped", flush=True)

    # ---- Cross-engine contract: DuckDB (read engine) must read Spark's Delta ----
    probe_ts = os.path.join(REPO, "apps", "api", "scripts", "_probe_duckdb_read.ts")
    if os.path.exists(probe_ts):
        res = subprocess.run(
            ["npx", "tsx", "--env-file=.env.local", probe_ts],
            cwd=os.path.join(REPO, "apps", "api"),
            capture_output=True,
            text=True,
        )
        out_lines = [ln for ln in (res.stdout or "").splitlines()
                     if ln.startswith("DUCK") or ln.startswith("ERR")]
        print("STEP10 duckdb read-back:\n%s" % "\n".join(out_lines), flush=True)
        if res.returncode != 0:
            print("STEP10 tail: %s" % (res.stderr or "")[-800:], flush=True)

    print("PROBE-SPARK-DONE", flush=True)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        traceback.print_exc()
        print("PROBE-SPARK-FAILED", flush=True)
        sys.exit(1)
