"""CLI entrypoint that executes one whitelisted lakehouse job.

Usage::

    python -m lakehouse.jobs.runner '<json payload>'

The payload is the :class:`lakehouse.jobs.protocol.JobRequest` document. The
result is printed to stdout as a single JSON line (the
:class:`~lakehouse.jobs.protocol.JobResponse`); logs go to stderr so stdout
stays machine-readable.

The TypeScript worker in ``apps/api`` spawns this process. That keeps Spark
out of the HTTP request path while still letting the control plane own the
job lifecycle.
"""

from __future__ import annotations

import json
import logging
import sys
from typing import Any

from lakehouse.jobs.protocol import (
    ALLOWED_OPERATIONS,
    OP_BRONZE_INGEST_CSV,
    OP_BRONZE_INGEST_JSON,
    OP_BRONZE_INGEST_STREAM,
    OP_GOLD_AGGREGATE,
    OP_SILVER_TRANSFORM,
    STATUS_FAILED,
    STATUS_SUCCEEDED,
    DatasetInfo,
    JobProtocolError,
    JobRequest,
    JobResponse,
)
from lakehouse.core.datasets import (
    GOLD_AGGREGATE_SOURCES as _GOLD_DEFAULT_SOURCES,
    GOLD_SOURCE_ATTRIBUTES as _GOLD_SOURCE_ATTRIBUTES,
    resolve_gold_source,
)

logger = logging.getLogger("lakehouse.jobs")

#: Silver transformers, keyed by the target table name.
_SILVER_TRANSFORMERS = {
    "customers": ("lakehouse.transform.batch.customers_transformer", "CustomersTransformer"),
    "products": ("lakehouse.transform.batch.products_transformer", "ProductsTransformer"),
    "orders": ("lakehouse.transform.batch.orders_transformer", "OrdersTransformer"),
}

#: Gold aggregators, keyed by the target table name.
_GOLD_AGGREGATORS = {
    "fact_orders": ("lakehouse.aggregate.batch.fact_orders_aggregator", "FactOrdersAggregator"),
    "dim_customers": ("lakehouse.aggregate.batch.dim_customers_aggregator", "DimCustomersAggregator"),
    "dim_products": ("lakehouse.aggregate.batch.dim_products_aggregator", "DimProductsAggregator"),
    "daily_revenue": ("lakehouse.aggregate.batch.daily_revenue_aggregator", "DailyRevenueAggregator"),
}


def _load_class(module_path: str, class_name: str) -> Any:
    import importlib

    module = importlib.import_module(module_path)
    return getattr(module, class_name)


def _delta_snapshot(spark: Any, path: str) -> tuple[int | None, int | None, int]:
    """Return ``(version, rowCount, bytes)`` for a Delta table at ``path``.

    The Delta API is version-specific, so the calls below were chosen from
    the *measured* schema of ``delta-spark 3.0.0`` (the jar this project
    ships), not from documentation:

    - ``DeltaTable.detail()`` returns a **DataFrame** with one row per
      table. Its columns are ``format, id, name, description, location,
      createdAt, lastModified, partitionColumns, numFiles, sizeInBytes,
      properties, minReaderVersion, minWriterVersion, tableFeatures``.
      It has **neither** ``version`` **nor** ``numRecords`` — the previous
      implementation called ``detail.get("version")`` on that DataFrame,
      which raised ``AttributeError: 'DataFrame' object has no attribute
      'get'`` and silently degraded every reported snapshot to
      ``deltaVersion=null, rowCount=null``.
    - The current table **version** comes from ``DeltaTable.history(1)``,
      whose rows expose a ``version`` column.
    - The table **row count** is not exposed by the metadata at all, so it
      is counted from the committed table. Counting is exact, which matters
      because the control plane reports this number as the job's row count.

    Any failure is non-fatal: the caller falls back to the row count the
    ingestor already knows, so a snapshot read never fails a job whose data
    was committed successfully.
    """
    try:
        from delta.tables import DeltaTable

        if not DeltaTable.isDeltaTable(spark, path):
            return None, None, 0

        table = DeltaTable.forPath(spark, path)

        detail_rows = table.detail().collect()
        detail = detail_rows[0].asDict() if detail_rows else {}
        size = int(detail.get("sizeInBytes") or 0)

        history_rows = table.history(1).collect()
        version: int | None = None
        if history_rows:
            raw_version = history_rows[0].asDict().get("version")
            if raw_version is not None:
                version = int(raw_version)

        row_count: int | None = None
        try:
            row_count = int(table.toDF().count())
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning(" Could not count rows of %s: %s", path, exc)

        return version, row_count, size
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning(" Could not read Delta snapshot for %s: %s", path, exc)
        return None, None, 0


def _dataset_info(layer: str, database: str, table: str, path: str) -> DatasetInfo:
    from lakehouse.core.datasets import PROVIDER_LOCAL

    return DatasetInfo(
        provider=PROVIDER_LOCAL,
        layer=layer,
        database=database,
        table=table,
        path=path,
    )


# ----------------------------------------------------------------------
# Operations
# ----------------------------------------------------------------------
def _run_bronze_ingest_csv(request: JobRequest) -> tuple[JobResponse, DatasetInfo]:
    from lakehouse.core.paths import LakePaths
    from lakehouse.ingest.batch.csv_ingestor import CsvIngestor

    source = request.require_str("source")
    database = request.require_str("database")
    table = request.require_str("table")
    options = request.params.get("options") or {}
    if not isinstance(options, dict):
        raise JobProtocolError("options must be an object")

    paths = LakePaths()
    target = f"{database}/{table}"
    ingestor = CsvIngestor(paths=paths)
    rows = ingestor.ingest_source(source, target)
    path = paths.table_path(_layer("bronze"), database, table)
    version, row_count, size = _delta_snapshot(ingestor.spark, path)
    dataset = _dataset_info("bronze", database, table, path)
    dataset = DatasetInfo(
        provider=dataset.provider,
        layer=dataset.layer,
        database=dataset.database,
        table=dataset.table,
        path=dataset.path,
        delta_version=version,
        row_count=row_count,
    )
    return (
        JobResponse(
            status=STATUS_SUCCEEDED,
            operation=request.operation,
            job_id=request.job_id,
            rows=int(row_count if row_count is not None else rows),
            bytes=size,
            dataset=dataset,
            metrics={"source": source, "approxRows": rows},
        ),
        dataset,
    )


def _run_bronze_ingest_json(request: JobRequest) -> tuple[JobResponse, DatasetInfo]:
    from lakehouse.core.paths import LakePaths
    from lakehouse.ingest.batch.json_ingestor import JsonIngestor

    source = request.require_str("source")
    database = request.require_str("database")
    table = request.require_str("table")

    paths = LakePaths()
    target = f"{database}/{table}"
    ingestor = JsonIngestor(paths=paths)
    rows = ingestor.ingest_source(source, target)
    path = paths.table_path(_layer("bronze"), database, table)
    version, row_count, size = _delta_snapshot(ingestor.spark, path)
    dataset = _dataset_info("bronze", database, table, path)
    dataset = DatasetInfo(
        provider=dataset.provider,
        layer=dataset.layer,
        database=dataset.database,
        table=dataset.table,
        path=dataset.path,
        delta_version=version,
        row_count=row_count,
    )
    return (
        JobResponse(
            status=STATUS_SUCCEEDED,
            operation=request.operation,
            job_id=request.job_id,
            rows=int(row_count if row_count is not None else rows),
            bytes=size,
            dataset=dataset,
            metrics={"source": source, "approxRows": rows},
        ),
        dataset,
    )


def _run_bronze_ingest_stream(request: JobRequest) -> tuple[JobResponse, DatasetInfo]:
    from lakehouse.ingest.streaming.bounded_stream_ingestor import BoundedStreamIngestor
    from lakehouse.core.paths import LakePaths

    topic = request.require_str("topic")
    database = request.require_str("database")
    table = request.require_str("table")
    max_messages = request.optional_int("maxMessages", 10_000)
    timeout_ms = request.optional_int("timeoutMs", 60_000)
    consumer_group = request.optional_str("consumerGroup") or "bronze-ingestor"

    paths = LakePaths()
    ingestor = BoundedStreamIngestor(
        paths=paths,
        topic=topic,
        database=database,
        table=table,
        consumer_group=consumer_group,
        max_messages=max_messages,
        timeout_ms=timeout_ms,
    )
    result = ingestor.run()
    path = paths.table_path(_layer("bronze"), database, table)
    version, row_count, size = _delta_snapshot(ingestor.spark, path)
    dataset = _dataset_info("bronze", database, table, path)
    dataset = DatasetInfo(
        provider=dataset.provider,
        layer=dataset.layer,
        database=dataset.database,
        table=dataset.table,
        path=dataset.path,
        delta_version=version,
        row_count=row_count,
    )
    metrics = {
        "topic": topic,
        "consumerGroup": consumer_group,
        "consumed": result.consumed,
        "written": result.rows,
        "malformed": result.malformed,
        "committed": result.committed,
        "partitionOffsets": result.partition_offsets,
    }
    # A stream ingest that consumed nothing and committed nothing must not be
    # reported as a success: no Bronze table was produced, so the catalog
    # would point at a dataset that does not exist. This is the
    # "no false-success" rule of MASTER PLAN §04 applied at the protocol
    # layer, so every consumer of the runner sees the same truth.
    if result.rows <= 0 and not (row_count or 0):
        return (
            JobResponse(
                status=STATUS_FAILED,
                operation=request.operation,
                job_id=request.job_id,
                rows=0,
                bytes=size,
                dataset=dataset,
                metrics=metrics,
                error=(
                    f"No records were consumed from topic {topic!r} within "
                    f"{timeout_ms}ms; no data was written to Bronze "
                    f"{database}/{table}."
                ),
            ),
            dataset,
        )
    return (
        JobResponse(
            status=STATUS_SUCCEEDED,
            operation=request.operation,
            job_id=request.job_id,
            rows=int(row_count or result.rows),
            bytes=size,
            dataset=dataset,
            metrics=metrics,
        ),
        dataset,
    )


def _run_silver_transform(request: JobRequest) -> tuple[JobResponse, DatasetInfo]:
    from lakehouse.core.paths import LakePaths

    target_table = request.require_str("targetTable")
    database = request.require_str("database")
    source_table = request.optional_str("sourceTable") or target_table

    spec = _SILVER_TRANSFORMERS.get(target_table)
    if spec is None:
        raise JobProtocolError(
            f"Unsupported silver transform target: {target_table!r} "
            f"(allowed: {sorted(_SILVER_TRANSFORMERS)})"
        )
    transformer_cls = _load_class(*spec)
    paths = LakePaths()
    transformer = transformer_cls(paths=paths)
    # Instance attributes shadow the class defaults, so the canonical
    # (database, table) pair wins over the historical hard-coded constants.
    transformer.BRONZE_TABLE = f"{database}/{source_table}"
    transformer.SILVER_TABLE = f"{database}/{target_table}"
    # `refresh` rebuilds the table (overwrite); `incremental` appends the new
    # rows so the Delta history of previous runs is preserved.
    transformer.MODE = "append" if request.optional_str("mode") == "incremental" else "overwrite"
    rows = transformer.transform()

    path = paths.table_path(_layer("silver"), database, target_table)
    version, row_count, size = _delta_snapshot(transformer.spark, path)
    dataset = _dataset_info("silver", database, target_table, path)
    dataset = DatasetInfo(
        provider=dataset.provider,
        layer=dataset.layer,
        database=dataset.database,
        table=dataset.table,
        path=dataset.path,
        delta_version=version,
        row_count=row_count,
    )
    return (
        JobResponse(
            status=STATUS_SUCCEEDED,
            operation=request.operation,
            job_id=request.job_id,
            rows=int(row_count if row_count is not None else rows),
            bytes=size,
            dataset=dataset,
            metrics={"sourceTable": source_table, "targetTable": target_table},
        ),
        dataset,
    )


def _run_gold_aggregate(request: JobRequest) -> tuple[JobResponse, DatasetInfo]:
    from lakehouse.core.paths import LakePaths

    target_table = request.require_str("targetTable")
    database = request.require_str("database")

    spec = _GOLD_AGGREGATORS.get(target_table)
    if spec is None:
        raise JobProtocolError(
            f"Unsupported gold aggregate target: {target_table!r} "
            f"(allowed: {sorted(_GOLD_AGGREGATORS)})"
        )
    aggregator_cls = _load_class(*spec)
    paths = LakePaths()
    aggregator = aggregator_cls(paths=paths)
    aggregator.GOLD_TABLE = f"{database}/{target_table}"
    # The Silver sources live in their OWN database segments (`erp/orders`,
    # `crm/customers`), not in the Gold segment (`retail`). Resolving a source
    # with the Gold database segment would point Spark at a path that does
    # not exist, so every source is resolved through the canonical mapping
    # (MASTER PLAN §05.1 — one canonical mapping, no path guessing).
    source_tables = request.params.get("sourceTables")
    if not isinstance(source_tables, list) or not source_tables:
        source_tables = list(_GOLD_DEFAULT_SOURCES.get(target_table, ()))
    for source in source_tables:
        if not isinstance(source, str):
            raise JobProtocolError("sourceTables entries must be strings")
        resolved = resolve_gold_source(source)
        if resolved is None:
            raise JobProtocolError(
                f"Unsupported Gold source table: {source!r} "
                f"(allowed: {sorted(_GOLD_SOURCE_ATTRIBUTES)})"
            )
        source_database, source_table = resolved
        attribute = _GOLD_SOURCE_ATTRIBUTES[source_table]
        if hasattr(aggregator, attribute):
            setattr(aggregator, attribute, f"{source_database}/{source_table}")
    rows = aggregator.build()

    path = paths.table_path(_layer("gold"), database, target_table)
    version, row_count, size = _delta_snapshot(aggregator.spark, path)
    dataset = _dataset_info("gold", database, target_table, path)
    dataset = DatasetInfo(
        provider=dataset.provider,
        layer=dataset.layer,
        database=dataset.database,
        table=dataset.table,
        path=dataset.path,
        delta_version=version,
        row_count=row_count,
    )
    return (
        JobResponse(
            status=STATUS_SUCCEEDED,
            operation=request.operation,
            job_id=request.job_id,
            rows=int(row_count if row_count is not None else rows),
            bytes=size,
            dataset=dataset,
            metrics={"targetTable": target_table},
        ),
        dataset,
    )


def _layer(name: str):
    from lakehouse.core.constants import Layer

    return {
        "bronze": Layer.BRONZE,
        "silver": Layer.SILVER,
        "gold": Layer.GOLD,
    }[name]


_HANDLERS = {
    OP_BRONZE_INGEST_CSV: _run_bronze_ingest_csv,
    OP_BRONZE_INGEST_JSON: _run_bronze_ingest_json,
    OP_BRONZE_INGEST_STREAM: _run_bronze_ingest_stream,
    OP_SILVER_TRANSFORM: _run_silver_transform,
    OP_GOLD_AGGREGATE: _run_gold_aggregate,
}


def execute(request: JobRequest) -> JobResponse:
    """Execute a parsed request and return the response (never raises)."""
    handler = _HANDLERS.get(request.operation)
    if handler is None:
        return JobResponse(
            status=STATUS_FAILED,
            operation=request.operation,
            job_id=request.job_id,
            error=f"Unsupported operation: {request.operation!r}",
        )
    try:
        response, _dataset = handler(request)
        return response
    except JobProtocolError as exc:
        logger.warning(" Job %s rejected: %s", request.job_id, exc)
        return JobResponse(
            status=STATUS_FAILED,
            operation=request.operation,
            job_id=request.job_id,
            error=str(exc),
        )
    except Exception as exc:
        logger.exception(" Job %s failed", request.job_id)
        return JobResponse(
            status=STATUS_FAILED,
            operation=request.operation,
            job_id=request.job_id,
            error=f"{type(exc).__name__}: {exc}",
        )


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(
        level=logging.INFO,
        stream=sys.stderr,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    args = list(sys.argv[1:] if argv is None else argv)
    raw = args[0] if args else sys.stdin.read()

    try:
        request = JobRequest.parse(raw)
    except JobProtocolError as exc:
        # A malformed request still gets a machine-readable response so the
        # control plane never sees an unhandled crash.
        response = JobResponse(
            status=STATUS_FAILED,
            operation="unknown",
            job_id="",
            error=str(exc),
        )
        print(response.to_json())
        return 1

    response = execute(request)
    print(response.to_json())
    return 0 if response.status == STATUS_SUCCEEDED else 1


if __name__ == "__main__":
    sys.exit(main())
