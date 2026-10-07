from __future__ import annotations
import logging
from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F
from lakehouse.core.constants import Layer
from lakehouse.core.paths import LakePaths
from lakehouse.core.spark import get_spark_session
from lakehouse.storage.delta_writer import write_delta_table
logger = logging.getLogger(__name__)

class ProductsTransformer:
    BRONZE_TABLE = 'erp/products'
    SILVER_TABLE = 'products'

    def __init__(self, spark: SparkSession | None=None, *, paths: LakePaths | None=None) -> None:
        self.spark = spark or get_spark_session('ProductsTransformer')
        self.paths = paths or LakePaths()

    def transform(self) -> int:
        logger.info(' Transform: products')
        bronze_df = self.spark.read.format('delta').load(self.paths.bronze(self.BRONZE_TABLE))
        silver_df = bronze_df.filter(F.col('product_id').isNotNull()).filter(F.col('price') > 0).withColumn('product_name', F.trim(F.col('product_name'))).withColumn('brand', F.initcap(F.col('brand'))).withColumn('margin', F.round((F.col('price') - F.col('cost')) / F.col('price') * 100, 2)).withColumn('price_tier', F.when(F.col('price') < 500, 'cheap').when(F.col('price') < 2000, 'affordable').when(F.col('price') < 10000, 'mid_range').otherwise('premium')).withColumn('processing_date', F.date_format(F.current_timestamp(), 'yyyy-MM-dd')).dropDuplicates(['product_id'])
        write_delta_table(silver_df, layer=Layer.SILVER, table_name=self.SILVER_TABLE, paths=self.paths, mode='overwrite', partition_by='processing_date')
        count = silver_df.count()
        logger.info(' %d products → silver/%s', count, self.SILVER_TABLE)
        return count

def main() -> None:
    logging.basicConfig(level=logging.INFO)
    ProductsTransformer().transform()
if __name__ == '__main__':
    main()