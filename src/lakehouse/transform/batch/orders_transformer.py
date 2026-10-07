from __future__ import annotations
import logging
from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F
from lakehouse.core.constants import Layer
from lakehouse.core.paths import LakePaths
from lakehouse.core.spark import get_spark_session
from lakehouse.storage.delta_writer import write_delta_table
logger = logging.getLogger(__name__)

class OrdersTransformer:
    BRONZE_TABLE = 'erp/orders'
    SILVER_TABLE = 'orders'

    def __init__(self, spark: SparkSession | None=None, *, paths: LakePaths | None=None) -> None:
        self.spark = spark or get_spark_session('OrdersTransformer')
        self.paths = paths or LakePaths()

    def transform(self) -> int:
        logger.info(' Transform: orders')
        bronze_df = self.spark.read.format('delta').load(self.paths.bronze(self.BRONZE_TABLE))
        silver_df = bronze_df.filter(F.col('order_id').isNotNull()).filter(F.col('customer_id').isNotNull()).filter(F.col('line_total') > 0).withColumn('order_date', F.to_date('order_date')).withColumn('status', F.lower(F.trim(F.col('status')))).withColumn('processing_date', F.date_format(F.current_timestamp(), 'yyyy-MM-dd')).dropDuplicates(['order_id'])
        write_delta_table(silver_df, layer=Layer.SILVER, table_name=self.SILVER_TABLE, paths=self.paths, mode='overwrite', partition_by='order_date')
        count = silver_df.count()
        logger.info(' %d orders → silver/%s', count, self.SILVER_TABLE)
        return count

def main() -> None:
    logging.basicConfig(level=logging.INFO)
    OrdersTransformer().transform()
if __name__ == '__main__':
    main()