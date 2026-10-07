from __future__ import annotations
import logging
from pyspark.sql import DataFrame, SparkSession
from pyspark.sql.streaming import StreamingQuery
from pyspark.sql.types import StructType
from lakehouse.core.constants import DEFAULT_KAFKA_BOOTSTRAP, KafkaTopics
from lakehouse.core.env import get_env
from lakehouse.core.paths import LakePaths
from lakehouse.core.spark import get_spark_session
from lakehouse.schemas import ECOMMERCE_PRICE_SCHEMA, ECOMMERCE_PRODUCT_SCHEMA, ECOMMERCE_REVIEW_SCHEMA
from lakehouse.storage.delta_writer import write_delta_streaming
logger = logging.getLogger(__name__)

class EcommerceIngestor:
    TOPICS_SCHEMAS: dict[str, tuple[str, StructType]] = {KafkaTopics.ECOMMERCE_PRODUCTS: ('products', ECOMMERCE_PRODUCT_SCHEMA), KafkaTopics.ECOMMERCE_REVIEWS: ('reviews', ECOMMERCE_REVIEW_SCHEMA), KafkaTopics.ECOMMERCE_PRICES: ('prices', ECOMMERCE_PRICE_SCHEMA)}

    def __init__(self, spark: SparkSession | None=None, *, paths: LakePaths | None=None, kafka_bootstrap: str | None=None) -> None:
        self.spark = spark or get_spark_session('EcommerceIngestor', with_kafka=True)
        self.paths = paths or LakePaths()
        self.kafka_bootstrap = kafka_bootstrap or get_env('KAFKA_BOOTSTRAP', DEFAULT_KAFKA_BOOTSTRAP)

    def _read_topic(self, topic: str, schema: StructType) -> DataFrame:
        from pyspark.sql import functions as F
        return self.spark.readStream.format('kafka').option('kafka.bootstrap.servers', self.kafka_bootstrap).option('subscribe', topic).option('startingOffsets', 'latest').option('failOnDataLoss', 'false').option('maxOffsetsPerTrigger', 5000).load().select(F.col('key').cast('string').alias('kafka_key'), F.col('offset').alias('kafka_offset'), F.col('partition').alias('kafka_partition'), F.col('timestamp').alias('kafka_timestamp'), F.from_json(F.col('value').cast('string'), schema).alias('data')).select('kafka_key', 'kafka_offset', 'kafka_partition', 'kafka_timestamp', 'data.*')

    def run(self) -> list[StreamingQuery]:
        from lakehouse.core.constants import Layer
        queries: list[StreamingQuery] = []
        logger.info(' E-commerce ingest: %d topics', len(self.TOPICS_SCHEMAS))
        for (topic, (name, schema)) in self.TOPICS_SCHEMAS.items():
            logger.info('  → Reading topic %s → ecommerce/%s', topic, name)
            df = self._read_topic(topic, schema)
            query = write_delta_streaming(df, layer=Layer.BRONZE, table_name=f'ecommerce/{name}', paths=self.paths, output_mode='append', partition_by=None, trigger_available_now=True)
            queries.append(query)
        return queries

def main() -> None:
    logging.basicConfig(level=logging.INFO)
    ingestor = EcommerceIngestor()
    queries = ingestor.run()
    for q in queries:
        q.awaitTermination()
if __name__ == '__main__':
    main()