from __future__ import annotations

import logging

from delta.tables import DeltaTable
from pyspark.sql import DataFrame
from pyspark.sql.streaming import StreamingQuery

from lakehouse.core.constants import DEFAULT_PARTITION_BY, Layer
from lakehouse.core.paths import LakePaths

logger = logging.getLogger(__name__)


def write_delta_table(
    df: DataFrame,
    layer: Layer,
    table_name: str,
    *,
    paths: LakePaths | None = None,
    mode: str = "overwrite",
    partition_by: str | list[str] | None = DEFAULT_PARTITION_BY,
    merge_schema: bool = True,
) -> None:
    paths = paths or LakePaths()
    base_path = _layer_path(paths, layer)
    full_path = f"{base_path}{table_name}/"
    writer = df.write.format("delta").mode(mode)
    if partition_by:
        if isinstance(partition_by, str):
            partition_by = [partition_by]
        writer = writer.partitionBy(*partition_by)
    if merge_schema:
        writer = writer.option("mergeSchema", "true")
    writer.save(full_path)
    logger.info(" Written to %s", full_path)


def quarantine_bad_records(
    df: DataFrame,
    layer: Layer,
    table_name: str,
    *,
    paths: LakePaths | None = None,
    error_col: str = "_error",
    reason: str = "malformed",
) -> int:
    """
    Separate malformed rows and write them to a quarantine path.

    This function reads a DataFrame that must contain an ``_error`` column
    (boolean: True = malformed). It writes malformed rows to
    ``<layer>/<table_name>/_quarantine/<date>/`` and returns the count.

    Rationale: silently dropping bad rows hides data loss. Quarantine preserves
    them for manual review while still allowing the clean DataFrame to proceed.

    Parameters
    ----------
    df : DataFrame
        Input DataFrame with an ``_error`` boolean column.
    layer, table_name, paths : standard write_delta_table arguments.
    error_col : str
        Name of the error column in df (default ``_error``).
    reason : str
        Human-readable label written to ``_quarantine_reason`` on each quarantined row.

    Returns
    -------
    int
        Number of rows written to quarantine.

    Example
    -------
    >>> bad_rows = df.filter(df._error == True)
    >>> quarantine_count = quarantine_bad_records(
    ...     df, Layer.BRONZE, "orders",
    ...     error_col="_parse_error",
    ...     reason="date_format_invalid",
    ... )
    >>> clean_df = df.filter(df._error == False).drop(df._error)
    """
    paths = paths or LakePaths()
    import datetime
    today = datetime.date.today().isoformat()
    q_path = f"{_layer_path(paths, layer)}{table_name}/_quarantine/{today}/"
    q_df = (
        df.filter(f"{error_col} = True")
        .withColumn("_quarantine_reason", __import__("pyspark.sql.functions").lit(reason))
        .withColumn(
            "_quarantine_timestamp",
            __import__("pyspark.sql.functions").current_timestamp(),
        )
    )
    n = q_df.count()
    if n > 0:
        q_df.drop(error_col).write.format("delta").mode("append").partitionBy(
            "_quarantine_reason"
        ).save(q_path)
        logger.warning(
            " Quarantined %d malformed rows → %s (reason: %s)",
            n,
            q_path,
            reason,
        )
    else:
        logger.info(" No malformed rows to quarantine for %s/%s", layer.value, table_name)
    return n


def write_delta_streaming(
    df: DataFrame,
    layer: Layer,
    table_name: str,
    *,
    paths: LakePaths | None = None,
    output_mode: str = "append",
    partition_by: str | list[str] | None = DEFAULT_PARTITION_BY,
    trigger_available_now: bool = True,
    checkpoint_dir: str | None = None,
) -> StreamingQuery:
    paths = paths or LakePaths()
    base_path = _layer_path(paths, layer)
    full_path = f"{base_path}{table_name}/"
    ckpt = checkpoint_dir or paths.checkpoint(layer, table_name)
    from pyspark.sql import functions as F

    enriched = df.withColumn("_processing_timestamp", F.current_timestamp()).withColumn(
        "_ingestion_date", F.date_format(F.current_timestamp(), "yyyy-MM-dd")
    )
    if not DeltaTable.isDeltaTable(df.sparkSession, full_path):
        empty_table = df.sparkSession.createDataFrame([], enriched.schema)
        table_writer = empty_table.write.format("delta").mode("append")
        if partition_by:
            partitions = [partition_by] if isinstance(partition_by, str) else partition_by
            table_writer = table_writer.partitionBy(*partitions)
        table_writer.save(full_path)
    writer = (
        enriched.writeStream.format("delta")
        .outputMode(output_mode)
        .option("checkpointLocation", ckpt)
        .option("path", full_path)
        # Per-task attempt idempotency: same (micro-batch id, partition) -> same
        # output file name, so a re-attempt in the same epoch does not write
        # duplicates. Combined with Delta transaction log this gives us
        # at-least-once delivery with deterministic file paths. It is NOT
        # exactly-once end-to-end — see docs/architecture/STREAMING_SEMANTICS.md
        # for the precise failure-mode analysis.
        .option("txnVersion", "1")
        .option("txnAppId", table_name)
        # Bound S3A retries so a brief MinIO blip does not cause a 30-minute
        # streaming-task retry storm (default = 10 attempts at 30s each).
        .option(
            "spark.hadoop.fs.s3a.connection.timeout", "20000"
        )
        .option("spark.hadoop.fs.s3a.attempts", "2")
    )
    if partition_by:
        if isinstance(partition_by, str):
            partition_by = [partition_by]
        writer = writer.partitionBy(*partition_by)
    if trigger_available_now:
        writer = writer.trigger(availableNow=True)
    else:
        writer = writer.trigger(processingTime="10 seconds")
    return writer.start()


def _layer_path(paths: LakePaths, layer: Layer) -> str:
    if layer == Layer.BRONZE:
        return paths.bronze("")
    if layer == Layer.SILVER:
        return paths.silver("")
    return paths.gold("")
