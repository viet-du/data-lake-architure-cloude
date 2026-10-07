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

class EcommerceMetricsAggregator:

    def __init__(self, spark: SparkSession | None=None, *, paths: LakePaths | None=None) -> None:
        self.spark = spark or get_spark_session('EcommerceMetricsAggregator', with_kafka=True)
        self.paths = paths or LakePaths()

    def category_metrics(self, products_silver: DataFrame) -> DataFrame:
        return products_silver.withWatermark('_crawl_timestamp', '10 minutes').groupBy(F.window(F.col('_crawl_timestamp'), '5 minutes'), F.col('category_name')).agg(F.count('*').alias('product_count'), F.avg('price').alias('avg_price'), F.avg('rating_average').alias('avg_rating'), F.sum('order_count').alias('total_orders'))

    def price_tier_metrics(self, products_silver: DataFrame) -> DataFrame:
        return products_silver.withWatermark('_crawl_timestamp', '10 minutes').groupBy(F.window(F.col('_crawl_timestamp'), '5 minutes'), F.col('price_tier')).agg(F.count('*').alias('product_count'), F.avg('price').alias('avg_price'), F.avg('discount_rate_pct').alias('avg_discount'))

    def seller_metrics(self, products_silver: DataFrame) -> DataFrame:
        return products_silver.withWatermark('_crawl_timestamp', '10 minutes').groupBy(F.window(F.col('_crawl_timestamp'), '5 minutes'), F.col('seller_name')).agg(F.count('*').alias('product_count'), F.sum(F.col('order_count')).alias('total_orders'), F.avg('rating_average').alias('avg_rating'))

    def build(self) -> list[StreamingQuery]:
        products_silver = self.spark.readStream.format('delta').load(self.paths.silver('ecommerce/products'))
        queries: list[StreamingQuery] = []
        for (name, df) in [('category_metrics', self.category_metrics(products_silver)), ('price_tier_metrics', self.price_tier_metrics(products_silver)), ('seller_metrics', self.seller_metrics(products_silver))]:
            queries.append(write_delta_streaming(df, layer=Layer.GOLD, table_name=f'ecommerce/{name}', paths=self.paths, output_mode='append', partition_by=None))
        return queries

def main() -> None:
    logging.basicConfig(level=logging.INFO)
    queries = EcommerceMetricsAggregator().build()
    for q in queries:
        q.awaitTermination()
if __name__ == '__main__':
    main()