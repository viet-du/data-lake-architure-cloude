"""Verify local Spark can write and read a temporary Delta table in R2."""

from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from lakehouse.core.paths import LakePaths  # noqa: E402
from lakehouse.core.spark import build_spark_session  # noqa: E402


def main() -> None:
    if not os.environ.get("S3_ENDPOINT"):
        raise RuntimeError("Set S3_ENDPOINT to your Cloudflare R2 S3 endpoint")

    target = LakePaths().bronze(f"_connection_test/{uuid.uuid4().hex}")
    spark = build_spark_session("Lakehouse-R2-Connection-Test", master="local[2]")
    failure: Exception | None = None
    try:
        spark.range(1).write.format("delta").mode("error").save(target)
        rows = spark.read.format("delta").load(target).count()
        if rows != 1:
            raise AssertionError(f"Expected one row in the R2 Delta smoke test, found {rows}")
        print(f"PASS: Delta write/read succeeded at s3a://bronze/{target.split('bronze/', 1)[1]}")
    except Exception as error:
        failure = error
        raise
    finally:
        try:
            path = spark._jvm.org.apache.hadoop.fs.Path(target)
            path.getFileSystem(spark._jsc.hadoopConfiguration()).delete(path, True)
        except Exception as cleanup_error:
            if failure is None:
                raise RuntimeError(
                    f"R2 smoke-test data could not be deleted at {target}"
                ) from cleanup_error
            print(
                f"WARNING: failed to clean up only the generated smoke-test path {target}: "
                f"{cleanup_error}",
                file=sys.stderr,
            )
        finally:
            spark.stop()


if __name__ == "__main__":
    main()
