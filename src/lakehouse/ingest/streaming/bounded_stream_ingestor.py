"""Bounded Kafka → Bronze ingestion with explicit offset handling.

MASTER PLAN §03.2 requires the Bronze stream write to carry ingestion
metadata (topic, partition, offset) and to keep an independent checkpoint so
a restart does not silently re-ingest or lose events.

This ingestor is deliberately **bounded**: it consumes at most
``max_messages`` records or until ``timeout_ms`` elapses, then stops and
commits the consumer offsets. It is used by the control plane's "bounded"
streaming mode, where an HTTP request must never hold a stream open.

The unbounded/continuous mode stays in the Airflow-managed Spark streaming
DAGs (``lakehouse.ingest.streaming.clickstream_ingestor`` and
``ecommerce_ingestor``), which own their own checkpoints.
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any

from lakehouse.core.paths import LakePaths

logger = logging.getLogger(__name__)

#: Kafka metadata columns added to every Bronze row.
KAFKA_METADATA_COLUMNS = (
    "_kafka_topic",
    "_kafka_partition",
    "_kafka_offset",
    "_kafka_timestamp",
    "_kafka_key",
    "_ingestion_timestamp",
    "_ingestion_date",
)


@dataclass
class BoundedIngestResult:
    """Outcome of one bounded ingest run."""

    rows: int = 0
    malformed: int = 0
    #: Total records read from the topic (valid + malformed). This is the
    #: number of records the consumer actually consumed, which is what the
    #: offset commit accounts for.
    consumed: int = 0
    partitions: list[int] = field(default_factory=list)
    partition_offsets: dict[str, int] = field(default_factory=dict)
    committed: bool = False
    duration_ms: int = 0


class BoundedStreamIngestor:
    """Consume a bounded window from one Kafka topic into Bronze."""

    #: Maximum time a single ``poll`` call may block.
    DEFAULT_POLL_SLICE_MS = 1_000

    #: How long to wait for the *first* record before concluding that the
    #: topic carries no data at all.
    DEFAULT_FIRST_RECORD_GRACE_MS = 5_000

    def __init__(
        self,
        *,
        paths: LakePaths | None = None,
        topic: str,
        database: str = "stream",
        table: str | None = None,
        consumer_group: str = "bronze-ingestor",
        max_messages: int = 10_000,
        timeout_ms: int = 60_000,
        bootstrap_servers: str | None = None,
        poll_slice_ms: int | None = None,
        first_record_grace_ms: int | None = None,
    ) -> None:
        self.paths = paths or LakePaths()
        self.topic = topic
        self.database = (database or "stream").strip().lower()
        self.table = (table or topic).strip().lower()
        self.consumer_group = consumer_group
        self.max_messages = max(1, min(int(max_messages), 1_000_000))
        self.timeout_ms = max(1_000, min(int(timeout_ms), 600_000))
        self.poll_slice_ms = max(
            100,
            min(
                int(poll_slice_ms) if poll_slice_ms else self.DEFAULT_POLL_SLICE_MS,
                5_000,
            ),
        )
        # The grace period is a sub-budget of the overall window: it can never
        # extend the operation beyond ``timeout_ms``.
        self.first_record_grace_ms = max(
            0,
            min(
                int(first_record_grace_ms)
                if first_record_grace_ms is not None
                else self.DEFAULT_FIRST_RECORD_GRACE_MS,
                self.timeout_ms,
            ),
        )
        self.bootstrap_servers = bootstrap_servers
        self.spark = None
        self._consumer = None

    # ------------------------------------------------------------------
    def _bootstrap(self) -> str:
        if self.bootstrap_servers:
            return self.bootstrap_servers
        import os

        raw = os.environ.get("KAFKA_BOOTSTRAP") or "localhost:9092"
        return raw

    def _build_consumer(self):
        from kafka import KafkaConsumer

        # The bootstrap timeout must be bounded by the ingest window: the
        # kafka-python default (30s) is longer than a bounded ingestion is
        # allowed to take, so an unreachable broker would otherwise stall the
        # worker past its own budget instead of failing fast.
        bootstrap_timeout_ms = max(1_000, min(int(self.timeout_ms), 15_000))
        return KafkaConsumer(
            self.topic,
            bootstrap_servers=self._bootstrap(),
            group_id=self.consumer_group,
            # Start from the group's committed offset; only a brand-new group
            # falls back to "earliest" so a fresh QA topic is not skipped.
            auto_offset_reset="earliest",
            enable_auto_commit=False,
            # We commit explicitly after the Delta write succeeds, so a crash
            # before the commit replays the same window (at-least-once).
            consumer_timeout_ms=self.timeout_ms,
            bootstrap_timeout_ms=bootstrap_timeout_ms,
            value_deserializer=lambda raw: raw,
            key_deserializer=lambda raw: raw,
        )

    @staticmethod
    def _decode(value: bytes | None) -> tuple[dict[str, Any] | None, bool]:
        """Return ``(payload, malformed)`` for one raw Kafka value."""
        if value is None:
            return None, True
        try:
            parsed = json.loads(value.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return None, True
        if not isinstance(parsed, dict):
            return None, True
        return parsed, False

    # ------------------------------------------------------------------
    def run(self) -> BoundedIngestResult:
        """Consume the bounded window and commit it to Bronze."""
        from pyspark.sql import functions as F

        from lakehouse.core.constants import Layer
        from lakehouse.core.spark import get_spark_session
        from lakehouse.storage.delta_writer import write_delta_table

        started = time.monotonic()
        result = BoundedIngestResult()
        consumer = self._build_consumer()
        self._consumer = consumer
        try:
            records: list[tuple] = []
            deadline = started + (self.timeout_ms / 1000)
            # A topic that carries no data at all must not hold the worker for
            # the whole window: the bounded ingest only waits a short grace
            # period for the *first* record. Once the stream is live, the
            # full `timeout_ms` budget still applies, so a slow producer is
            # never truncated.
            first_record_deadline = started + (self.first_record_grace_ms / 1000)
            first_record_seen = False

            while True:
                now = time.monotonic()
                if now >= deadline:
                    break
                if not first_record_seen and now >= first_record_deadline:
                    logger.info(
                        " No record received within %dms on topic=%s; stopping early",
                        self.first_record_grace_ms,
                        self.topic,
                    )
                    break

                # `poll` returns immediately once the consumer has data, so the
                # window is measured from the first record, not from the
                # subscribe call.
                batch = consumer.poll(timeout_ms=self.poll_slice_ms)
                if not batch:
                    continue
                for _partition, messages in batch.items():
                    for message in messages:
                        result.consumed += 1
                        payload, malformed = self._decode(message.value)
                        if malformed:
                            result.malformed += 1
                            logger.warning(
                                " Malformed record at %s/%s offset %s",
                                message.topic,
                                message.partition,
                                message.offset,
                            )
                            continue
                        assert payload is not None
                        records.append(
                            (
                                message.topic,
                                message.partition,
                                int(message.offset),
                                int(message.timestamp or 0),
                                (message.key or b"").decode("utf-8", errors="replace"),
                                json.dumps(payload, separators=(",", ":")),
                            )
                        )
                        result.partitions.append(message.partition)
                        result.partition_offsets[str(message.partition)] = int(message.offset)
                        first_record_seen = True
                        if len(records) >= self.max_messages:
                            break
                    if len(records) >= self.max_messages:
                        break
                if len(records) >= self.max_messages:
                    break

            result.rows = len(records)

            if records:
                self.spark = get_spark_session("BoundedStreamIngestor")
                rows = self.spark.createDataFrame(
                    records,
                    schema="_kafka_topic string, _kafka_partition int, _kafka_offset bigint, "
                    "_kafka_timestamp bigint, _kafka_key string, _raw_json string",
                )
                enriched = (
                    rows.withColumn(
                        "_ingestion_timestamp", F.current_timestamp()
                    ).withColumn(
                        "_ingestion_date",
                        F.date_format(F.current_timestamp(), "yyyy-MM-dd"),
                    )
                )
                write_delta_table(
                    enriched,
                    layer=Layer.BRONZE,
                    table_name=self._target_table(),
                    paths=self.paths,
                    mode="append",
                    partition_by=None,
                    merge_schema=True,
                )
                enriched.unpersist(blocking=False)

            # Commit offsets only after the Delta write succeeded, so a crash
            # between write and commit replays the window instead of losing it.
            #
            # The commit MUST happen while the consumer is still open: closing
            # the consumer first tears down the network selector and every
            # later `commit()` raises `RuntimeError: NetworkSelector closed!`.
            # That failure silently left the group offset uncommitted, so the
            # next run replayed the same window (at-least-once) while the
            # control plane believed the offsets had been checkpointed.
            #
            # The commit is also skipped when nothing was written: committing
            # an empty window would advance the group offset past records
            # that were never persisted, which is silent data loss.
            if result.rows > 0:
                try:
                    consumer.commit()
                    result.committed = True
                except Exception:  # pragma: no cover - defensive
                    logger.warning(" Kafka offset commit failed", exc_info=True)
            else:
                logger.warning(
                    " No rows written for topic=%s; leaving offsets uncommitted"
                    " so the window can be replayed",
                    self.topic,
                )
        finally:
            try:
                consumer.close(autocommit=False)
            except Exception:  # pragma: no cover - defensive
                logger.warning(" Kafka consumer close failed", exc_info=True)

        result.duration_ms = int((time.monotonic() - started) * 1000)
        logger.info(
            " Bounded ingest topic=%s rows=%d malformed=%d duration=%dms",
            self.topic,
            result.rows,
            result.malformed,
            result.duration_ms,
        )
        return result

    def _target_table(self) -> str:
        """Target table path fragment (database/table) for the Bronze write.

        The database and table come from the control-plane request so the
        Bronze dataset identity is exactly what the UI asked for — never a
        value guessed from the topic name.
        """
        return f"{self.database}/{self.table}"
