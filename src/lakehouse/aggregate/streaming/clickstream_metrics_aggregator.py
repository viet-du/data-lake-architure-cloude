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

class ClickstreamMetricsAggregator:

    def __init__(self, spark: SparkSession | None=None, *, paths: LakePaths | None=None) -> None:
        self.spark = spark or get_spark_session('ClickstreamMetricsAggregator', with_kafka=True)
        self.paths = paths or LakePaths()

    def build(self) -> list[StreamingQuery]:
        silver = self.spark.readStream.format('delta').load(self.paths.silver('clickstream/events'))
        page_views = silver.filter(F.col('event_type') == 'page_view').withWatermark('event_timestamp', '10 minutes').groupBy(F.window(F.col('event_timestamp'), '5 minutes')).agg(F.count('*').alias('page_views'), F.countDistinct('user_id').alias('unique_users'), F.countDistinct('session_id').alias('unique_sessions'))
        top_pages = silver.filter(F.col('event_type') == 'page_view').withWatermark('event_timestamp', '10 minutes').groupBy(F.window(F.col('event_timestamp'), '5 minutes'), F.col('page_url')).agg(F.count('*').alias('views'))
        queries: list[StreamingQuery] = []
        queries.append(write_delta_streaming(page_views, layer=Layer.GOLD, table_name='clickstream/page_views_5min', paths=self.paths, output_mode='append', partition_by=None))
        queries.append(write_delta_streaming(top_pages, layer=Layer.GOLD, table_name='clickstream/top_pages_5min', paths=self.paths, output_mode='append', partition_by=None))
        return queries

def main() -> None:
    logging.basicConfig(level=logging.INFO)
    queries = ClickstreamMetricsAggregator().build()
    for q in queries:
        q.awaitTermination()
if __name__ == '__main__':
    main()