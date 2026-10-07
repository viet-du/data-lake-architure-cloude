from __future__ import annotations
import logging
from pyspark.sql import DataFrame, SparkSession
from pyspark.sql.streaming import StreamingQuery
from lakehouse.core.constants import DEFAULT_KAFKA_BOOTSTRAP, KafkaTopics
from lakehouse.core.env import get_env
from lakehouse.core.paths import LakePaths
from lakehouse.core.spark import get_spark_session
from lakehouse.schemas import CLICKSTREAM_SCHEMA
from lakehouse.storage.delta_writer import write_delta_streaming
logger = logging.getLogger(__name__)

class ClickstreamIngestor:
    TARGET_TABLE = 'clickstream/events'

    def __init__(self, spark: SparkSession | None=None, *, paths: LakePaths | None=None, kafka_bootstrap: str | None=None, topic: str | None=None) -> None:
        self.spark = spark or get_spark_session('ClickstreamIngestor', with_kafka=True)
        self.paths = paths or LakePaths()
        self.kafka_bootstrap = kafka_bootstrap or get_env('KAFKA_BOOTSTRAP', DEFAULT_KAFKA_BOOTSTRAP)
        self.topic = topic or KafkaTopics.CLICKSTREAM_EVENTS

    def read_stream(self) -> DataFrame:
        from pyspark.sql import functions as F
        return self.spark.readStream.format('kafka').option('kafka.bootstrap.servers', self.kafka_bootstrap).option('subscribe', self.topic).option('startingOffsets', 'latest').option('failOnDataLoss', 'false').option('maxOffsetsPerTrigger', 5000).load().select(F.col('key').cast('string').alias('kafka_key'), F.col('offset').alias('kafka_offset'), F.col('partition').alias('kafka_partition'), F.col('timestamp').alias('kafka_timestamp'), F.from_json(F.col('value').cast('string'), CLICKSTREAM_SCHEMA).alias('data')).select('kafka_key', 'kafka_offset', 'kafka_partition', 'kafka_timestamp', 'data.*')

    def write_to_bronze(self, df: DataFrame) -> StreamingQuery:
        from lakehouse.core.constants import Layer
        return write_delta_streaming(df, layer=Layer.BRONZE, table_name=self.TARGET_TABLE, paths=self.paths, output_mode='append', partition_by=None, trigger_available_now=True)

    def run(self) -> StreamingQuery:
        logger.info(' Clickstream ingest: topic=%s', self.topic)
        df = self.read_stream()
        query = self.write_to_bronze(df)
        logger.info(' Started ingest query: %s', query.name)
        return query

def main() -> None:
    logging.basicConfig(level=logging.INFO)
    ingestor = ClickstreamIngestor()
    query = ingestor.run()
    query.awaitTermination()
if __name__ == '__main__':
    main()