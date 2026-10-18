"""
Run the data-lake-architecture pipeline on a Databricks cluster.

Usage on a Databricks notebook (after uploading the repo to /Workspace/):

    %pip install delta-spark==3.0.0

    import sys
    sys.path.insert(0, "/Workspace/Repos/<your-username>/data-lake-architecture/src")
    # or, if you uploaded the project to /Workspace/Users/<you>/data-lake-architecture:
    # sys.path.insert(0, "/Workspace/Users/<you>/data-lake-architecture/src")

    from lakehouse.run_on_databricks import run_batch_retail, run_stream_clickstream
    run_batch_retail()
    # or:
    run_stream_clickstream(duration_seconds=60)

The module auto-detects:
  - DATABRICKS_RUNTIME_VERSION (set by every cluster)
  - SparkSession.getActiveSession() (notebook session)
and uses Unity Catalog Volumes (path mode = "volume") by default.

You can override path mode with `path_mode="dbfs"` if your workspace allows
DBFS root, or `path_mode="volume"` (default) to use /Volumes/<catalog>/...
"""
from __future__ import annotations

import logging
import os
import threading
import time

from lakehouse.aggregate.batch.dim_customers_aggregator import DimCustomersAggregator
from lakehouse.core.constants import Layer
from lakehouse.core.paths import LakePaths
from lakehouse.storage.delta_writer import write_delta_table
from lakehouse.transform.batch.customers_transformer import CustomersTransformer

logger = logging.getLogger(__name__)


def _is_on_databricks() -> bool:
    """True when running inside a Databricks cluster (any tier)."""
    return "DATABRICKS_RUNTIME_VERSION" in os.environ or bool(
        os.environ.get("SPARK_LOCAL_IP")
    )


def _ensure_paths_env(path_mode: str = "volume") -> None:
    """Set DATABRICKS_PATH_MODE so paths.LakePaths picks the right backend.

    Default: 'volume' → /Volumes/<catalog>/<layer>/<vol_name>/...
    Override: 'dbfs'   → dbfs:/lakehouse/<layer>/...
    """
    os.environ["ENV"] = "databricks"
    os.environ.setdefault("DATABRICKS_PATH_MODE", path_mode)
    # DATABRICKS_CATALOG defaults to "workspace" in env.py / paths.py.


def _get_spark():
    from lakehouse.core.spark import get_spark_session

    return get_spark_session("DatabricksLakehouse")


def run_batch_retail(
    *,
    csv_path: str = "/databricks-datasets/retail-org/customers/customers.csv",
    path_mode: str = "volume",
    limit: int | None = None,
) -> None:
    """Run end-to-end Bronze→Silver→Gold on the retail customers dataset.

    Parameters
    ----------
    csv_path : str
        Source CSV (default: Databricks built-in retail dataset).
    path_mode : str
        'volume' (default) or 'dbfs'.
    limit : int | None
        If set, only process the first N rows (useful for smoke tests).
    """
    _ensure_paths_env(path_mode)
    spark = _get_spark()
    paths = LakePaths()
    catalog = paths.catalog
    logger.info("Running on Databricks: catalog=%s, path_mode=%s", catalog, path_mode)
    logger.info("Bronze path: %s", paths.bronze("customers"))
    logger.info("Silver path: %s", paths.silver("customers"))
    logger.info("Gold path  : %s", paths.gold("dim_customers"))

    # 1. Bronze — read CSV, add metadata, write to Delta
    from pyspark.sql import functions as F

    df = (
        spark.read.option("header", True)
        .option("inferSchema", True)
        .csv(csv_path)
    )
    if limit:
        df = df.limit(limit)
    df = (
        df.withColumn("_source_file", F.lit(csv_path))
        .withColumn("_ingestion_timestamp", F.current_timestamp())
        .withColumn("_ingestion_date", F.date_format(F.current_timestamp(), "yyyy-MM-dd"))
    )
    logger.info("Loaded %d rows from %s", df.count(), csv_path)
    write_delta_table(
        df,
        layer=Layer.BRONZE,
        table_name="customers",
        paths=paths,
        mode="overwrite",
        partition_by=None,
        merge_schema=True,
    )

    # 2. Silver
    CustomersTransformer(spark=spark, paths=paths).run()

    # 3. Gold
    DimCustomersAggregator(spark=spark, paths=paths).run()

    # 4. Verify
    if path_mode == "volume":
        _verify_volume(paths)
    logger.info("✅ batch_retail complete")


def run_stream_clickstream(
    *,
    duration_seconds: int = 60,
    path_mode: str = "volume",
    kafka_bootstrap: str = "localhost:9092",
) -> None:
    """Run the clickstream streaming pipeline for a fixed duration.

    The pipeline:
      1. Reads from Kafka topic 'clickstream-events' (must be produced by
         the lakehouse Kafka producer — see scripts/produce_kafka.sh)
      2. Writes to Bronze Delta table (Volume or DBFS)
      3. Transforms → Silver Delta
      4. Aggregates → Gold (page_views_5min, top_pages_5min)

    Parameters
    ----------
    duration_seconds : int
        How long to awaitTermination before stopping queries.
    path_mode : str
        'volume' (default) or 'dbfs'.
    kafka_bootstrap : str
        Kafka broker address. On Databricks cluster, you can use
        'localhost:9092' if you started Kafka on the cluster, or your
        own Confluent/Redpanda endpoint.
    """
    _ensure_paths_env(path_mode)
    _get_spark()  # init Spark session early so any errors surface before we start threads

    # Make Kafka reachable from cluster. The cluster has its own Kafka
    # (databricks/open-source) reachable at localhost:9092 if you installed
    # it. Alternatively pass your own broker.
    os.environ.setdefault("KAFKA_BOOTSTRAP", kafka_bootstrap)

    from lakehouse.pipelines.stream_clickstream import ClickstreamStreamingPipeline

    pipeline = ClickstreamStreamingPipeline()
    pipeline.run()  # type: ignore[attr-defined]  # sets up streaming queries
    queries = pipeline.queries()  # type: ignore[attr-defined]
    logger.info(
        "Streaming clickstream: %d queries, running for %ds",
        len(queries),
        duration_seconds,
    )

    def _stop_after() -> None:
        time.sleep(duration_seconds)
        for q in queries:
            try:
                q.stop()
            except Exception as e:  # noqa: BLE001
                logger.warning("Error stopping query %s: %s", q.name, e)

    threading.Thread(target=_stop_after, daemon=True).start()
    for q in queries:
        try:
            q.awaitTermination()
        except Exception as e:  # noqa: BLE001
            logger.warning("Query %s terminated: %s", q.name, e)

    logger.info("✅ stream_clickstream stopped after %ds", duration_seconds)


def _verify_volume(paths: LakePaths) -> None:
    """Print row counts for each layer (volume mode only)."""
    from pyspark.sql import SparkSession

    spark = SparkSession.getActiveSession()
    if not spark:
        return
    for layer_name in ("bronze", "silver", "gold"):
        try:
            base = getattr(paths, layer_name)("")
            df = spark.read.format("delta").load(base.rstrip("/"))
            count = df.count()
            logger.info("  %s rows: %d (path=%s)", layer_name, count, base)
        except Exception as e:  # noqa: BLE001
            logger.info("  %s: (no data) %s", layer_name, e)


def show_storage_layout() -> None:
    """Print the resolved storage layout for the active ENV (debug helper)."""
    from lakehouse.core.constants import Layer

    paths = LakePaths()
    print("=" * 60)
    print(f"  ENV      : {os.getenv('ENV', 'local')}")
    print(f"  Catalog  : {paths.catalog}")
    print(f"  Protocol : {paths.protocol}")
    print(f"  Bronze   : {paths.bronze('')}")
    print(f"  Silver   : {paths.silver('')}")
    print(f"  Gold     : {paths.gold('')}")
    print(f"  Ckpt(B)  : {paths.checkpoint(Layer.BRONZE, 'demo')}")
    print(f"  Ckpt(S)  : {paths.checkpoint(Layer.SILVER, 'demo')}")
    print(f"  Ckpt(G)  : {paths.checkpoint(Layer.GOLD, 'demo')}")
    print(f"  Tbl      : {paths.table_name(Layer.BRONZE, 'customers')}")
    print("=" * 60)
