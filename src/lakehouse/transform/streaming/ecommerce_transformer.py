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

class EcommerceTransformer:
    TABLES = ['products', 'reviews', 'prices']

    def __init__(self, spark: SparkSession | None=None, *, paths: LakePaths | None=None) -> None:
        self.spark = spark or get_spark_session('EcommerceTransformer', with_kafka=True)
        self.paths = paths or LakePaths()

    def transform_products(self, df: DataFrame) -> DataFrame:
        return df.filter(F.col('id').isNotNull()).filter(F.col('price') > 0).withColumn('product_name', F.trim(F.col('name'))).withColumn('brand_name', F.initcap(F.col('brand_name'))).withColumn('rating_average', F.round(F.col('rating_average'), 2)).withColumn('discount_amount', F.col('original_price') - F.col('price')).withColumn('is_on_sale', F.when(F.col('discount_rate') > 0, True).otherwise(False)).withColumn('popularity_score', F.col('review_count') * 0.4 + F.col('order_count') * 0.5 + F.col('rating_average') * 100 * 0.1).withColumn('price_tier', F.when(F.col('price') < 500000, 'cheap').when(F.col('price') < 2000000, 'affordable').when(F.col('price') < 10000000, 'mid_range').when(F.col('price') < 30000000, 'premium').otherwise('luxury')).withColumn('processing_date', F.date_format(F.current_timestamp(), 'yyyy-MM-dd'))

    def transform_reviews(self, df: DataFrame) -> DataFrame:
        return df.filter(F.col('product_id').isNotNull()).filter(F.col('rating').between(1, 5)).withColumn('title', F.trim(F.col('title'))).withColumn('content', F.trim(F.col('content'))).withColumn('content_length', F.length(F.col('content'))).withColumn('sentiment', F.when(F.col('rating') >= 4, 'positive').when(F.col('rating') == 3, 'neutral').otherwise('negative')).withColumn('review_date', F.to_date('created_at'))

    def run(self) -> list[StreamingQuery]:
        queries: list[StreamingQuery] = []
        products_bronze = self.spark.readStream.format('delta').option('ignoreChanges', 'true').load(self.paths.bronze('ecommerce/products'))
        products_silver = self.transform_products(products_bronze)
        queries.append(write_delta_streaming(products_silver, layer=Layer.SILVER, table_name='ecommerce/products', paths=self.paths, output_mode='append', partition_by='processing_date'))
        reviews_bronze = self.spark.readStream.format('delta').option('ignoreChanges', 'true').load(self.paths.bronze('ecommerce/reviews'))
        reviews_silver = self.transform_reviews(reviews_bronze)
        queries.append(write_delta_streaming(reviews_silver, layer=Layer.SILVER, table_name='ecommerce/reviews', paths=self.paths, output_mode='append', partition_by='review_date'))
        return queries

def main() -> None:
    logging.basicConfig(level=logging.INFO)
    queries = EcommerceTransformer().run()
    for q in queries:
        q.awaitTermination()
if __name__ == '__main__':
    main()