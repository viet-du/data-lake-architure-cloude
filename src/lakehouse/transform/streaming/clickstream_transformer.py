from __future__ import annotations

import logging

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.streaming import StreamingQuery

from lakehouse.core.constants import Layer
from lakehouse.core.paths import LakePaths
from lakehouse.core.spark import get_spark_session
from lakehouse.storage.delta_writer import write_delta_streaming

logger = logging.getLogger(__name__)


class ClickstreamTransformer:
    BRONZE_TABLE = "clickstream/events"
    SILVER_TABLE = "clickstream/events"

    def __init__(
        self, spark: SparkSession | None = None, *, paths: LakePaths | None = None
    ) -> None:
        self.spark = spark or get_spark_session("ClickstreamTransformer", with_kafka=True)
        self.paths = paths or LakePaths()

    def read_bronze(self) -> DataFrame:
        return (
            self.spark.readStream.format("delta")
            .option("ignoreChanges", "true")
            .load(self.paths.bronze(self.BRONZE_TABLE))
        )

    def transform(self, df: DataFrame) -> DataFrame:
        # `timestamp` from producers is ISO-8601 in UTC (e.g. "2026-10-16T09:33:00Z"
        # or "2026-10-16T09:33:00.123456Z"). We parse with an explicit timezone so
        # event_timestamp is non-ambiguous. If the producer forgot the "Z",
        # to_timestamp will still parse it but treat it as a local timestamp —
        # we add a soft warning by leaving the column unaltered when parsing
        # returns NULL instead of dropping the row.
        return (
            df.filter(F.col("event_id").isNotNull())
            .filter(F.col("user_id").isNotNull())
            .filter(F.col("event_type").isNotNull())
            .withColumn(
                "event_timestamp",
                F.coalesce(
                    F.to_timestamp("timestamp", "yyyy-MM-dd'T'HH:mm:ss.SSSSSSXXX"),
                    F.to_timestamp("timestamp", "yyyy-MM-dd'T'HH:mm:ssXXX"),
                    F.to_timestamp("timestamp", "yyyy-MM-dd'T'HH:mm:ss"),
                ),
            )
            .withColumn("device", F.get_json_object("metadata", "$.device"))
            .withColumn("event_date", F.date_format(F.col("event_timestamp"), "yyyy-MM-dd"))
            # NOTE: dropDuplicates on a streaming DataFrame dedupes within a
            # single micro-batch only. Producer-side event_id must be globally
            # unique (e.g. UUIDv4) for end-to-end dedup; see
            # docs/architecture/STREAMING_SEMANTICS.md.
            .dropDuplicates(["event_id"])
        )

    def run(self) -> StreamingQuery:
        logger.info(" Transform: clickstream (streaming)")
        bronze_df = self.read_bronze()
        silver_df = self.transform(bronze_df)
        return write_delta_streaming(
            silver_df,
            layer=Layer.SILVER,
            table_name=self.SILVER_TABLE,
            paths=self.paths,
            output_mode="append",
            partition_by="event_date",
            trigger_available_now=False,
        )


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    q = ClickstreamTransformer().run()
    q.awaitTermination()


if __name__ == "__main__":
    main()
