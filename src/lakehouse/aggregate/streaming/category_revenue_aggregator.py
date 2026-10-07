from __future__ import annotations
import logging
from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.streaming import StreamingQuery
from lakehouse.core.constants import DEFAULT_KAFKA_BOOTSTRAP, KafkaTopics, Layer
from lakehouse.core.env import get_env
from lakehouse.core.paths import LakePaths
from lakehouse.core.spark import get_spark_session
from lakehouse.storage.delta_writer import write_delta_streaming
logger = logging.getLogger(__name__)

class CategoryRevenueAggregator:

    def __init__(self, spark: SparkSession | None=None, *, paths: LakePaths | None=None, kafka_bootstrap: str | None=None) -> None:
        self.spark = spark or get_spark_session('CategoryRevenueAggregator', with_kafka=True)
        self.paths = paths or LakePaths()
        self.kafka_bootstrap = kafka_bootstrap or get_env('KAFKA_BOOTSTRAP', DEFAULT_KAFKA_BOOTSTRAP)

    def read_kafka(self) -> DataFrame:
        return self.spark.readStream.format('kafka').option('kafka.bootstrap.servers', self.kafka_bootstrap).option('subscribe', KafkaTopics.TIKI_CATEGORY).option('startingOffsets', 'latest').load().selectExpr('CAST(value AS STRING) as json').selectExpr("from_json(json, 'product_id LONG, category_name STRING, price DOUBLE, order_count INT') as data").select('data.*')

    def revenue_by_category(self, df: DataFrame) -> DataFrame:
        return df.withWatermark('crawl_timestamp', '10 minutes').groupBy(F.window(F.col('crawl_timestamp'), '5 minutes'), F.col('category_name')).agg(F.countDistinct('product_id').alias('unique_products'), F.sum(F.col('price') * F.col('order_count')).alias('revenue'), F.avg('price').alias('avg_price'))

    def build(self) -> list[StreamingQuery]:
        df = self.read_kafka()
        revenue_df = self.revenue_by_category(df)
        return [write_delta_streaming(revenue_df, layer=Layer.GOLD, table_name='category_analytics/revenue_by_category', paths=self.paths, output_mode='append', partition_by=None)]

def main() -> None:
    logging.basicConfig(level=logging.INFO)
    queries = CategoryRevenueAggregator().build()
    for q in queries:
        q.awaitTermination()
if __name__ == '__main__':
    main()