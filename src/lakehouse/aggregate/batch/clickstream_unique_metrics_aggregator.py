from __future__ import annotations

import logging

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F

from lakehouse.core.constants import Layer
from lakehouse.core.paths import LakePaths
from lakehouse.core.spark import get_spark_session
from lakehouse.storage.delta_writer import write_delta_table

logger = logging.getLogger(__name__)


class ClickstreamUniqueMetricsAggregator:
    SILVER_TABLE = "clickstream/events"
    GOLD_TABLE = "clickstream/unique_metrics_5min"

    def __init__(
        self, spark: SparkSession | None = None, *, paths: LakePaths | None = None
    ) -> None:
        self.spark = spark or get_spark_session("ClickstreamUniqueMetricsAggregator")
        self.paths = paths or LakePaths()

    def build(self) -> DataFrame:
        events = self.spark.read.format("delta").load(self.paths.silver(self.SILVER_TABLE))
        return (
            events.filter(F.col("event_type") == "page_view")
            .filter(F.col("event_timestamp").isNotNull())
            .groupBy(F.window(F.col("event_timestamp"), "5 minutes"))
            .agg(
                F.countDistinct("user_id").alias("unique_users"),
                F.countDistinct("session_id").alias("unique_sessions"),
            )
            .select(
                F.col("window.start").alias("window_start"),
                F.col("window.end").alias("window_end"),
                "unique_users",
                "unique_sessions",
            )
        )

    def run(self) -> None:
        logger.info(" Build exact clickstream unique metrics")
        write_delta_table(
            self.build(),
            layer=Layer.GOLD,
            table_name=self.GOLD_TABLE,
            paths=self.paths,
            mode="overwrite",
            partition_by=None,
        )
        logger.info(" Wrote exact unique metrics to gold/%s", self.GOLD_TABLE)


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    ClickstreamUniqueMetricsAggregator().run()


if __name__ == "__main__":
    main()
