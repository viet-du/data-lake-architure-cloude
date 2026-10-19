"""Shared helpers for rubric-15 experiments.

Goal: keep experiment scripts self-contained while reusing the project's
Spark/Delta patterns. The scripts intentionally write to LOCAL filesystem
(``./_experiments_workspace/...``) instead of MinIO so they can run on a
student laptop without the Docker stack.

Each experiment function returns a small dict of measurements; the
caller (``__main__``) writes that dict to ``results/<experiment>.csv``
for the report.
"""

from __future__ import annotations

import csv
import os
import shutil
import subprocess
import time
from collections.abc import Callable
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from pyspark.sql import SparkSession

WORKSPACE_ROOT = Path("./_experiments_workspace").resolve()
RESULTS_ROOT = Path("./results").resolve()


def _resolve_jar_packages() -> str:
    """Reuse the same Delta + Kafka package versions as the rest of the repo."""
    try:
        from lakehouse.core.constants import DELTA_PACKAGE, KAFKA_PACKAGE

        return f"{DELTA_PACKAGE},{KAFKA_PACKAGE}"
    except Exception:  # noqa: BLE001 - experiments must work even if package not installed
        return "io.delta:delta-spark_2.12:3.0.0," "org.apache.spark:spark-sql-kafka-0-10_2.12:3.4.0"


def _require_java() -> str:
    candidates: list[str] = []
    java_home = os.environ.get("JAVA_HOME")
    if java_home:
        candidates.append(str(Path(java_home) / "bin" / "java"))
    candidates.extend(
        [
            "/opt/homebrew/opt/openjdk@11/bin/java",
            "/usr/lib/jvm/java-11-openjdk-amd64/bin/java",
            "/usr/lib/jvm/java-17-openjdk-amd64/bin/java",
            "/Library/Java/JavaVirtualMachines/temurin-11.jdk/Contents/Home/bin/java",
        ]
    )
    on_path = shutil.which("java")
    if on_path:
        candidates.append(on_path)

    for binary in candidates:
        try:
            result = subprocess.run(
                [binary, "-version"],
                capture_output=True,
                text=True,
                timeout=5,
            )
        except (OSError, subprocess.TimeoutExpired):
            continue
        if result.returncode == 0:
            resolved = Path(binary).resolve()
            os.environ["JAVA_HOME"] = str(resolved.parent.parent)
            return str(resolved)

    raise RuntimeError(
        "A working Java runtime is required for Spark. Set JAVA_HOME or install Java 11+."
    )


def build_local_spark(app_name: str) -> SparkSession:
    """Build a SparkSession that writes to local filesystem (no MinIO required).

    Reuses the Delta + Kafka package versions already pinned in
    ``src/lakehouse/core/constants.py`` so the experiment matches the rest
    of the pipeline.

    Why ``SPARK_LOCAL_IP=127.0.0.1`` + ``preferIPv4Stack=true``?

    Spark's ``Utils.localIpAddress`` calls ``InetAddress.getLocalHost``,
    which on a fresh macOS install triggers an IPv6 ``getaddrinfo`` that
    is blocked by the macOS application sandbox. Forcing loopback + IPv4
    avoids the DNS lookup entirely so the JVM can start. This has no
    effect on a real laptop — the only cost is that the Spark UI binds
    to 127.0.0.1 instead of the LAN IP, which is fine for experiments.

    Why local jars instead of ``spark.jars.packages``?

    Apache Ivy (Spark's dependency resolver) also calls
    ``InetAddress.getAllByName`` and is blocked by the sandbox. So we
    use ``spark.jars`` with ``file://`` URIs pointing at
    ``_experiments_workspace/.jars/`` (populated by
    ``experiments/fetch_jars.py``). On a real laptop, you can still
    swap back to ``spark.jars.packages`` and Ivy will work normally.
    """
    import os

    _require_java()
    os.environ.setdefault("SPARK_LOCAL_IP", "127.0.0.1")
    jars_dir = Path(__file__).parent.parent / "_experiments_workspace" / ".jars"
    local_jars = sorted(jars_dir.glob("*.jar"))
    if local_jars:
        jar_config = ("spark.jars", ",".join(f"file://{p}" for p in local_jars))
    else:
        # Fall back to Ivy — works on a real laptop, fails in sandbox.
        # Coordinates belong in spark.jars.packages; spark.jars only accepts
        # filesystem paths and otherwise treats the group ID as a URI scheme.
        jar_config = ("spark.jars.packages", _resolve_jar_packages())
    # NOTE: no spark.jars.ivySettings here. We rely on spark.jars
    # (file:// URIs) so Ivy is never invoked. The Spark launcher only
    # touches Maven when spark.jars.packages is set; with spark.jars it
    # just hands the paths to the executor classpath.

    # NOTE: we deliberately do NOT call ``configure_spark_with_delta_pip``
    # here. That helper always sets ``spark.jars.packages`` to
    # ``io.delta:delta-spark_2.12:<ver>``, which forces Apache Ivy to
    # hit Maven Central at runtime — and Ivy's ``getaddrinfo`` is
    # blocked by the macOS sandbox. We already pre-loaded the Delta
    # extension + catalog via local jars above, so we can call
    # ``getOrCreate()`` directly.
    builder = (
        SparkSession.builder.appName(app_name)
        .master("local[2]")
        .config("spark.driver.extraJavaOptions", "-Djava.net.preferIPv4Stack=true")
        .config(
            "spark.executor.extraJavaOptions",
            "-Djava.net.preferIPv4Stack=true",
        )
        .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
        .config(
            "spark.sql.catalog.spark_catalog",
            "org.apache.spark.sql.delta.catalog.DeltaCatalog",
        )
        .config("spark.databricks.delta.schema.autoMerge.enabled", "true")
        .config("spark.driver.memory", "1g")
        .config("spark.sql.shuffle.partitions", "4")
        .config(jar_config[0], jar_config[1])
    )
    return builder.getOrCreate()


@contextmanager
def timer(label: str, results: list[dict[str, Any]]):
    """Wall-clock timer that records into ``results``."""
    t0 = time.perf_counter()
    print(f"[{label}] start")
    yield
    elapsed = time.perf_counter() - t0
    print(f"[{label}] done in {elapsed:.3f}s")
    results.append({"step": label, "wall_time_sec": round(elapsed, 3)})


def reset_workspace(*subdirs: str) -> Path:
    """Delete and recreate an experiment directory under ``_experiments_workspace``.

    Each call gives the experiment a clean slate so re-running produces
    deterministic row counts. This is the local equivalent of
    ``make reset`` (the rubric explicitly asks for a reproducible
    notebook-style runner).
    """
    WORKSPACE_ROOT.mkdir(parents=True, exist_ok=True)
    for sub in subdirs:
        path = WORKSPACE_ROOT / sub
        if path.exists():
            shutil.rmtree(path)
        path.mkdir(parents=True, exist_ok=True)
    return WORKSPACE_ROOT / subdirs[-1] if subdirs else WORKSPACE_ROOT


def write_results_csv(name: str, rows: list[dict[str, Any]]) -> Path:
    """Persist a list of dicts to ``results/<name>.csv`` (mkdir if needed)."""
    RESULTS_ROOT.mkdir(parents=True, exist_ok=True)
    out = RESULTS_ROOT / f"{name}.csv"
    if not rows:
        out.write_text("step,wall_time_sec\n(no_data,0)\n", encoding="utf-8")
        return out
    fieldnames = list(dict.fromkeys(key for row in rows for key in row))
    with out.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    return out


def file_stats(path: Path) -> dict[str, int]:
    """Return number of files + total bytes under a directory."""
    if not path.exists():
        return {"file_count": 0, "total_bytes": 0}
    files = [p for p in path.rglob("*") if p.is_file()]
    return {
        "file_count": len(files),
        "total_bytes": sum(p.stat().st_size for p in files),
    }


def measure_table_size(spark: SparkSession, table_path: str) -> dict[str, Any]:
    """Return row count plus active Delta data-file metrics for a table path."""
    df = spark.read.format("delta").load(table_path)
    return {
        "table": table_path,
        "row_count": df.count(),
        **delta_table_stats(spark, table_path),
    }


def delta_table_stats(spark: SparkSession, table_path: str | Path) -> dict[str, int]:
    """Return active Delta data-file count and size, excluding transaction logs."""
    escaped_path = str(table_path).replace("`", "``")
    detail = spark.sql(f"DESCRIBE DETAIL delta.`{escaped_path}`").first()
    if detail is None:
        raise RuntimeError(f"Delta table detail is unavailable for {table_path}")
    return {
        "file_count": int(detail["numFiles"]),
        "total_bytes": int(detail["sizeInBytes"]),
    }


def run_step(label: str, fn: Callable[[], Any]) -> tuple[str, float, Any]:
    """Wrap a callable with a wall-clock timer; return (label, seconds, return_value)."""
    t0 = time.perf_counter()
    out = fn()
    elapsed = time.perf_counter() - t0
    print(f"  {label:38s}  {elapsed:7.3f}s")
    return label, elapsed, out


def env_summary() -> dict[str, str]:
    """Return key env vars for the audit log."""
    return {
        "JAVA_HOME": os.environ.get("JAVA_HOME", "<unset>"),
        "SPARK_LOCAL_IP": os.environ.get("SPARK_LOCAL_IP", "<unset>"),
        "cwd": os.getcwd(),
    }
