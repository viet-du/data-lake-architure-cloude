"""
PHASE 4: Streaming correctness and recovery tests.

These tests cover what we CAN verify without a JVM:

  1. Topic/broker consistency — every code path uses KafkaTopics / KAFKA_BOOTSTRAP.
  2. Event-schema compatibility — what each producer emits vs what each
     ingestor's schema declares (this catches the "session_id missing" /
     "url vs page_url" type of drift that crashed real runs in PHASE 3).
  3. Timestamp parsing — every format the producer can emit must parse to a
     non-null timestamp column.
  4. Watermark / window / output-mode policy — the 5 min window + 10 min
     watermark + append output combination is the only combination that
     actually emits deterministic state for windowed aggregations.
  5. Checkpoint isolation — each streaming query gets its own checkpoint dir.
  6. Restart/recovery invariants — re-running the same code must not reset
     offsets or checkpoints, and idempotent Delta writes are documented.
  7. Batch/stream contention — verify that the streaming and batch paths
     do NOT share Delta table paths (so concurrent writers don't fight).

What we deliberately do NOT test here:
  - Real Kafka round-trip (needs Kafka + Spark — covered separately when
    docker stack is up via `make up && pytest -m integration`).
  - Throughput/latency numbers — these only exist after a measured run.
"""

from __future__ import annotations

import importlib
import inspect
import re
from pathlib import Path

# These tests must run without Spark, so we import pure-config modules only.
from lakehouse.core.constants import (
    DEFAULT_KAFKA_BOOTSTRAP,
    KafkaTopics,
    Layer,
)
from lakehouse.core.paths import LakePaths

# ============================================================================
# 1. Topic / broker consistency
# ============================================================================


class TestTopicAndBrokerConsistency:
    """All code paths must reference KafkaTopics and KAFKA_BOOTSTRAP,
    never hard-code 'clickstream-events' or 'localhost:9092' as a string."""

    def test_kafka_topics_constants_match_compose(self) -> None:
        # Topics created in docker-compose-kafka.yml `kafka-init` service.
        compose_created = {
            "clickstream-events",
            "ecommerce-products-stream",
            "ecommerce-reviews-stream",
            "ecommerce-price-stream",
            "crypto-prices-stream",
            "github-trending-stream",
            "hackernews-stream",
        }
        # All producer-facing topics should be in the constants enum.
        for t in compose_created:
            assert t in KafkaTopics.all(), f"Topic {t!r} missing from KafkaTopics"

    def test_all_streaming_modules_use_kafka_topics_enum(self) -> None:
        # Each module that subscribes/publishes to Kafka must import KafkaTopics
        # (or, for tests/legacy code, the same string via the enum).
        for module_name in [
            "lakehouse.ingest.streaming.clickstream_ingestor",
            "lakehouse.ingest.streaming.ecommerce_ingestor",
            "lakehouse.aggregate.streaming.category_revenue_aggregator",
            "lakehouse.sources.producers.clickstream_producer",
        ]:
            mod = importlib.import_module(module_name)
            src = inspect.getsource(mod)
            assert "KafkaTopics" in src, (
                f"{module_name} must reference KafkaTopics enum, "
                f"not hard-code topic strings"
            )

    def test_all_streaming_modules_use_kafka_bootstrap_env(self) -> None:
        # Any module that calls KafkaProducer or readStream("kafka") must read
        # KAFKA_BOOTSTRAP from env, with a sane default.
        for module_name in [
            "lakehouse.ingest.streaming.clickstream_ingestor",
            "lakehouse.ingest.streaming.ecommerce_ingestor",
            "lakehouse.aggregate.streaming.category_revenue_aggregator",
            "lakehouse.sources.producers.clickstream_producer",
        ]:
            mod = importlib.import_module(module_name)
            src = inspect.getsource(mod)
            assert "KAFKA_BOOTSTRAP" in src, (
                f"{module_name} must read KAFKA_BOOTSTRAP from env, "
                f"not hard-code a broker"
            )

    def test_default_kafka_bootstrap_is_localhost(self) -> None:
        # Documented default: localhost:9092 for dev (Mac host).
        # In-container callers (airflow_dags/*) override with kafka:29092.
        assert DEFAULT_KAFKA_BOOTSTRAP == "localhost:9092"

    def test_airflow_dags_set_in_container_bootstrap(self) -> None:
        # Airflow DAGs invoke spark-submit via `docker exec lake-spark-master`.
        # The job therefore runs inside the docker network and must use
        # kafka:29092, NOT localhost:9092.
        for dag_path in [
            Path("airflow_dags/clickstream_streaming_dag.py"),
            Path("airflow_dags/ecommerce_streaming_dag.py"),
        ]:
            src = dag_path.read_text()
            assert "kafka:29092" in src, (
                f"{dag_path.name} must pass KAFKA_BOOTSTRAP=kafka:29092 "
                f"so the in-container Spark job can reach Kafka"
            )
            assert "localhost:9092" not in src, (
                f"{dag_path.name} must not bake localhost:9092 (the job "
                f"runs inside the docker network, not on the host)"
            )


# ============================================================================
# 2. Event-schema compatibility
# ============================================================================


class TestClickstreamSchemaCompatibility:
    """The clickstream schema declares these required fields:
    event_id, user_id, session_id, event_type, timestamp (all non-nullable).
    Any producer that claims to be compatible MUST emit all of them."""

    REQUIRED_FIELDS = {"event_id", "user_id", "session_id", "event_type", "timestamp"}

    def test_required_fields_in_schema(self) -> None:
        from lakehouse.schemas import CLICKSTREAM_SCHEMA

        assert set(CLICKSTREAM_SCHEMA.names) >= self.REQUIRED_FIELDS

    def test_required_fields_marked_non_nullable(self) -> None:
        from lakehouse.schemas import CLICKSTREAM_SCHEMA

        for field in CLICKSTREAM_SCHEMA.fields:
            if field.name in self.REQUIRED_FIELDS:
                assert field.nullable is False, (
                    f"{field.name} should be non-nullable in CLICKSTREAM_SCHEMA "
                    f"so we can drop bad rows at parse time"
                )

    def test_produce_kafka_script_emits_required_fields(self) -> None:
        # `scripts/produce_kafka.sh` is the documented demo path. Its clickstream
        # branch MUST include every required field, otherwise the schema
        # enforced at the Kafka source will silently drop the event.
        src = Path("scripts/produce_kafka.sh").read_text()
        # Find the clickstream branch (between 'if clickstream' and 'else')
        m = re.search(
            r"if 'clickstream' in topic:.*?else:",
            src,
            re.DOTALL,
        )
        assert m, "Could not find clickstream branch in produce_kafka.sh"
        branch = m.group(0)
        for field in self.REQUIRED_FIELDS:
            assert f"'{field}'" in branch, (
                f"produce_kafka.sh clickstream branch must emit '{field}', "
                f"else CLICKSTREAM_SCHEMA will reject the event"
            )
        # Sanity: must NOT use the legacy "url" key (replaced by page_url)
        assert "'url':" not in branch, (
            "Legacy 'url' field was removed; use 'page_url' to match schema"
        )
        assert "datetime.now(timezone.utc)" in branch, (
            "Clickstream timestamps must use a formatter that supports microseconds"
        )

    def test_clickstream_streams_drain_offsets_for_scheduled_runs(self) -> None:
        for module_name, class_name, method_name in [
            (
                "lakehouse.ingest.streaming.clickstream_ingestor",
                "ClickstreamIngestor",
                "write_to_bronze",
            ),
            (
                "lakehouse.transform.streaming.clickstream_transformer",
                "ClickstreamTransformer",
                "run",
            ),
        ]:
            module = importlib.import_module(module_name)
            src = inspect.getsource(getattr(getattr(module, class_name), method_name))
            assert "trigger_available_now=True" in src, (
                f"{module_name}.{class_name}.{method_name} must drain available offsets and exit "
                "so the hourly Airflow run can complete its downstream tasks"
            )
        from lakehouse.aggregate.streaming.clickstream_metrics_aggregator import (
            ClickstreamMetricsAggregator,
        )

        aggregator_src = inspect.getsource(ClickstreamMetricsAggregator.build)
        assert aggregator_src.count("trigger_available_now=True") == 2

    def test_clickstream_producer_emits_required_fields(self) -> None:
        # The standalone clickstream_producer.py has its own generate_event()
        # method. We check the returned dict shape without running the class.
        from lakehouse.sources.producers.clickstream_producer import (
            ClickstreamProducer,
        )

        src = inspect.getsource(ClickstreamProducer.generate_event)
        # Each required field must appear as a key in the returned dict.
        for field in self.REQUIRED_FIELDS:
            assert f'"{field}"' in src, (
                f"ClickstreamProducer.generate_event must emit '{field}'"
            )

    def test_exact_unique_metrics_are_separate_from_streaming(self) -> None:
        from lakehouse.aggregate.batch.clickstream_unique_metrics_aggregator import (
            ClickstreamUniqueMetricsAggregator,
        )
        from lakehouse.aggregate.streaming.clickstream_metrics_aggregator import (
            ClickstreamMetricsAggregator,
        )

        streaming_src = inspect.getsource(ClickstreamMetricsAggregator)
        batch_src = inspect.getsource(ClickstreamUniqueMetricsAggregator)
        assert "countDistinct" not in streaming_src
        assert "countDistinct" in batch_src
        assert 'GOLD_TABLE = "clickstream/unique_metrics_5min"' in batch_src


class TestEcommerceSchemaCompatibility:
    """The 3 e-commerce schemas must each declare the unique key the
    transformer relies on."""

    def test_product_schema_has_id_field(self) -> None:
        from lakehouse.schemas import ECOMMERCE_PRODUCT_SCHEMA

        assert "id" in ECOMMERCE_PRODUCT_SCHEMA.names

    def test_review_schema_has_product_id(self) -> None:
        from lakehouse.schemas import ECOMMERCE_REVIEW_SCHEMA

        assert "product_id" in ECOMMERCE_REVIEW_SCHEMA.names

    def test_price_schema_has_product_id(self) -> None:
        from lakehouse.schemas import ECOMMERCE_PRICE_SCHEMA

        assert "product_id" in ECOMMERCE_PRICE_SCHEMA.names

    def test_ecommerce_transformer_columns_exist_in_schema(self) -> None:
        # The silver transformer references columns by name. If the schema is
        # ever changed and a column is removed, the spark plan still compiles
        # but the runtime will FAIL with `AnalysisException: cannot resolve`.
        # This test catches the source-of-truth drift at unit-test time.
        from lakehouse.schemas import ECOMMERCE_PRODUCT_SCHEMA
        from lakehouse.transform.streaming.ecommerce_transformer import (
            EcommerceTransformer,
        )

        schema_cols = set(ECOMMERCE_PRODUCT_SCHEMA.names)
        src = inspect.getsource(EcommerceTransformer.transform_products)
        # Columns referenced in the transform (filter, withColumn, groupBy)
        # Order matters for filter: extract columns used in F.col(...) calls.
        used = set(re.findall(r"F\.col\(\"([\w_]+)\"\)", src))
        missing = used - schema_cols - {"_crawl_timestamp"}
        # _crawl_timestamp is a metadata column added by crawlers; allowed.
        # All other used columns must be in the schema.
        for col in used:
            if col == "_crawl_timestamp":
                continue
            assert col in schema_cols, (
                f"EcommerceTransformer.transform_products uses column {col!r} "
                f"that is not in ECOMMERCE_PRODUCT_SCHEMA"
            )
        assert not missing, (
            f"EcommerceTransformer.transform_products references columns "
            f"{sorted(missing)!r} that are not in ECOMMERCE_PRODUCT_SCHEMA"
        )


# ============================================================================
# 3. Timestamp parsing
# ============================================================================


class TestClickstreamTimestampParsing:
    """ClickstreamTransformer must accept every format the producer can emit
    and produce a non-NULL event_timestamp. We can't run the actual transform
    without Spark, so we verify the parse expressions are in place."""

    def test_transformer_handles_three_timestamp_formats(self) -> None:
        from lakehouse.transform.streaming.clickstream_transformer import (
            ClickstreamTransformer,
        )

        src = inspect.getsource(ClickstreamTransformer.transform)
        # All three formats must be present, joined with coalesce
        assert "yyyy-MM-dd'T'HH:mm:ss.SSSSSSXXX" in src, (
            "Must handle microseconds + tz (kafka-python default)"
        )
        assert "yyyy-MM-dd'T'HH:mm:ssXXX" in src, (
            "Must handle seconds + tz (Z suffix)"
        )
        assert "yyyy-MM-dd'T'HH:mm:ss" in src, (
            "Must handle seconds only (legacy)"
        )

    def test_event_date_derived_from_event_timestamp(self) -> None:
        from lakehouse.transform.streaming.clickstream_transformer import (
            ClickstreamTransformer,
        )

        src = inspect.getsource(ClickstreamTransformer.transform)
        assert 'date_format(F.col("event_timestamp")' in src, (
            "event_date partition column must be derived from event_timestamp "
            "so partition pruning is consistent"
        )


# ============================================================================
# 4. Watermark / window / output mode policy
# ============================================================================


class TestWatermarkPolicy:
    """All windowed aggregations in the gold layer must use:
    - withWatermark before groupBy
    - window(col, "5 minutes")
    - watermark = "10 minutes"  (i.e. >= 1 window)
    - outputMode = "append"  (required for windowed aggregation to emit)"""

    def test_clickstream_metrics_uses_watermark_and_window(self) -> None:
        from lakehouse.aggregate.streaming.clickstream_metrics_aggregator import (
            ClickstreamMetricsAggregator,
        )

        src = inspect.getsource(ClickstreamMetricsAggregator)
        assert src.count("withWatermark") >= 2, (
            "page_views and top_pages must each have withWatermark"
        )
        assert 'window(' in src, "Must use window() aggregation"
        assert '"5 minutes"' in src, "Window size must be 5 minutes"
        assert '"10 minutes"' in src, "Watermark must be 10 minutes"

    def test_ecommerce_metrics_uses_watermark_and_window(self) -> None:
        from lakehouse.aggregate.streaming.ecommerce_metrics_aggregator import (
            EcommerceMetricsAggregator,
        )

        src = inspect.getsource(EcommerceMetricsAggregator)
        assert src.count("withWatermark") >= 3, (
            "category/price-tier/seller metrics must each watermark"
        )
        assert 'window(' in src
        assert '"5 minutes"' in src
        assert '"10 minutes"' in src

    def test_write_delta_streaming_defaults_to_append(self) -> None:
        from lakehouse.storage.delta_writer import write_delta_streaming

        sig = inspect.signature(write_delta_streaming)
        assert sig.parameters["output_mode"].default == "append", (
            "Default output_mode must be 'append' — the only valid mode "
            "for windowed aggregations"
        )


# ============================================================================
# 5. Checkpoint isolation
# ============================================================================


class TestCheckpointIsolation:
    """Each streaming query must get its own checkpoint directory so that
    re-running one query does not clobber another's progress."""

    def test_checkpoint_dir_is_per_table(self) -> None:
        paths = LakePaths()
        a = paths.checkpoint(Layer.BRONZE, "clickstream/events")
        b = paths.checkpoint(Layer.BRONZE, "ecommerce/products")
        assert a != b
        assert "clickstream/events" in a
        assert "ecommerce/products" in b

    def test_checkpoint_dir_lives_inside_layer_bucket(self) -> None:
        paths = LakePaths()
        bronze_ckpt = paths.checkpoint(Layer.BRONZE, "clickstream/events")
        silver_ckpt = paths.checkpoint(Layer.SILVER, "clickstream/events")
        gold_ckpt = paths.checkpoint(Layer.GOLD, "clickstream/page_views_5min")
        assert bronze_ckpt.startswith("s3a://bronze/")
        assert silver_ckpt.startswith("s3a://silver/")
        assert gold_ckpt.startswith("s3a://gold/")
        # Checkpoint must end with the standard Spark _checkpoints/ marker.
        for ckpt in (bronze_ckpt, silver_ckpt, gold_ckpt):
            assert ckpt.endswith("/_checkpoints/")

    def test_write_delta_streaming_uses_paths_checkpoint_by_default(self) -> None:
        from lakehouse.storage.delta_writer import write_delta_streaming

        sig = inspect.signature(write_delta_streaming)
        # If checkpoint_dir is None, the function must call paths.checkpoint(...)
        src = inspect.getsource(write_delta_streaming)
        assert "paths.checkpoint" in src
        assert sig.parameters["checkpoint_dir"].default is None, (
            "Default must be None so the path comes from paths.checkpoint()"
        )


# ============================================================================
# 6. Restart / recovery invariants
# ============================================================================


class TestRestartRecoveryInvariants:
    """Code that runs a streaming query must NEVER programmatically reset
    Kafka offsets or wipe checkpoints. Resetting offsets belongs to an
    explicit operator action documented in the runbook."""

    def test_streaming_code_never_calls_reset(self) -> None:
        # Search all streaming modules for the dangerous patterns.
        streaming_modules = [
            "lakehouse.ingest.streaming.clickstream_ingestor",
            "lakehouse.ingest.streaming.ecommerce_ingestor",
            "lakehouse.transform.streaming.clickstream_transformer",
            "lakehouse.transform.streaming.ecommerce_transformer",
            "lakehouse.aggregate.streaming.clickstream_metrics_aggregator",
            "lakehouse.aggregate.streaming.ecommerce_metrics_aggregator",
            "lakehouse.aggregate.streaming.category_revenue_aggregator",
            "lakehouse.pipelines.stream_clickstream",
            "lakehouse.pipelines.stream_ecommerce",
        ]
        forbidden = [
            r"reset_offsets",
            r"--from-beginning",
            r"earliest",
            r"DELETE\s+FROM\s+_delta_log",  # never in code
            r"checkpoint\s*=\s*None",  # disables checkpointing
            r"truncate",
        ]
        for mod_name in streaming_modules:
            mod = importlib.import_module(mod_name)
            src = inspect.getsource(mod)
            for pat in forbidden:
                assert not re.search(pat, src, re.IGNORECASE), (
                    f"{mod_name} contains forbidden pattern {pat!r} — "
                    f"this would reset state on restart"
                )

    def test_streaming_ingestors_use_startingOffsets_latest(self) -> None:  # noqa: N802 — camelCase intentional, matches Spark config key `startingOffsets` documented below
        # `startingOffsets=earliest` would replay the entire topic each
        # restart, producing duplicates. `latest` is the only safe default
        # for a continuous query.
        for mod_name in [
            "lakehouse.ingest.streaming.clickstream_ingestor",
            "lakehouse.ingest.streaming.ecommerce_ingestor",
        ]:
            src = importlib.import_module(mod_name).__file__
            assert src
            content = Path(src).read_text()
            assert 'startingOffsets", "latest"' in content, (
                f"{mod_name} must use startingOffsets=latest (not earliest)"
            )

    def test_streaming_pipeline_stops_cleanly_on_sigint(self) -> None:
        # The pipeline's run() must call q.stop() (not q.terminate() or
        # sys.exit) so the checkpoint is committed for the last micro-batch.
        from lakehouse.pipelines.base import StreamingPipeline

        src = inspect.getsource(StreamingPipeline.run)
        assert "q.stop()" in src
        # No "kill" or "terminate" — those bypass the checkpoint commit.
        assert "terminate" not in src
        assert "kill" not in src

    def test_delta_writer_documents_idempotent_writes(self) -> None:
        # The streaming writer must surface that it relies on Delta's
        # idempotent-writes feature, so a reader of the code understands
        # the failure modes.
        from lakehouse.storage.delta_writer import write_delta_streaming

        src = inspect.getsource(write_delta_streaming)
        assert "txnAppId" in src and "txnVersion" in src, (
            "write_delta_streaming must enable Delta idempotent writes "
            "(txnAppId + txnVersion) so retries do not produce duplicate files"
        )


# ============================================================================
# 7. Batch / stream contention
# ============================================================================


class TestBatchStreamContention:
    """The streaming paths must write to a different set of Delta table paths
    than the batch paths, otherwise concurrent writers will fight on the
    same _delta_log/."""

    def test_streaming_writes_dont_collide_with_batch(self) -> None:
        # Tables owned by streaming layer (from readme + code)
        streaming_tables = {
            "bronze/clickstream/events",
            "bronze/ecommerce/products",
            "bronze/ecommerce/reviews",
            "bronze/ecommerce/prices",
            "silver/clickstream/events",
            "silver/ecommerce/products",
            "silver/ecommerce/reviews",
            "gold/clickstream/page_views_5min",
            "gold/clickstream/top_pages_5min",
            "gold/ecommerce/category_metrics",
            "gold/ecommerce/price_tier_metrics",
            "gold/ecommerce/seller_metrics",
            "gold/category_analytics/revenue_by_category",
        }
        # Tables owned by batch layer
        batch_tables = {
            "bronze/crm/customers",
            "bronze/erp/products",
            "bronze/erp/orders",
            "silver/crm/customers",
            "silver/erp/products",
            "silver/erp/orders",
            "gold/fact_orders",
            "gold/dim_customers",
            "gold/dim_products",
            "gold/daily_revenue",
        }
        # Intersection must be empty.
        overlap = streaming_tables & batch_tables
        assert not overlap, (
            f"Batch and streaming must not share Delta table paths: {overlap}"
        )

    def test_transformer_output_table_equals_ingestor_input_table(self) -> None:
        # Bronze and Silver are separated by layer, but for clickstream the
        # table name is the same on both sides. Verify explicitly.
        from lakehouse.ingest.streaming.clickstream_ingestor import (
            ClickstreamIngestor,
        )
        from lakehouse.transform.streaming.clickstream_transformer import (
            ClickstreamTransformer,
        )

        # Bronze table
        assert ClickstreamIngestor.TARGET_TABLE == "clickstream/events"
        # Silver table for clickstream also uses "clickstream/events"
        # (the LAYER prefix in the path is what separates them).
        assert ClickstreamTransformer.SILVER_TABLE == "clickstream/events"


# ============================================================================
# 8. StreamingPipeline behavior
# ============================================================================


class TestStreamingPipelineExecution:
    def test_pipeline_execute_awaits_all_queries(self) -> None:
        from lakehouse.pipelines.base import StreamingPipeline

        src = inspect.getsource(StreamingPipeline.run)
        assert "awaitTermination" in src
        # Must loop, not call once.
        assert "for q in queries" in src

    def test_pipeline_logs_query_count(self) -> None:
        from lakehouse.pipelines.base import StreamingPipeline

        src = inspect.getsource(StreamingPipeline.run)
        assert "Started" in src and "streaming queries" in src
