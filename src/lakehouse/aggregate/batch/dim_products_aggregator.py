from __future__ import annotations
import logging
from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F
from lakehouse.core.constants import Layer
from lakehouse.core.paths import LakePaths
from lakehouse.core.spark import get_spark_session
from lakehouse.storage.delta_writer import write_delta_table
logger = logging.getLogger(__name__)

class DimProductsAggregator:
    GOLD_TABLE = 'dim_products'

    def __init__(self, spark: SparkSession | None=None, *, paths: LakePaths | None=None) -> None:
        self.spark = spark or get_spark_session('DimProductsAggregator')
        self.paths = paths or LakePaths()

    def build(self) -> int:
        logger.info(' Build: dim_products')
        products = self.spark.read.format('delta').load(self.paths.silver('products'))
        orders = self.spark.read.format('delta').load(self.paths.silver('orders'))
        product_metrics = orders.groupBy('product_id').agg(F.countDistinct('order_id').alias('total_orders'), F.sum('quantity').alias('total_quantity_sold'), F.sum('line_total').alias('total_revenue'), F.avg('unit_price').alias('avg_selling_price'))
        dim = products.join(product_metrics, 'product_id', 'left').withColumn('is_best_seller', F.when(F.col('total_quantity_sold') >= 100, True).otherwise(False)).fillna(0, subset=['total_orders', 'total_quantity_sold', 'total_revenue']).withColumn('processing_date', F.date_format(F.current_timestamp(), 'yyyy-MM-dd'))
        write_delta_table(dim, layer=Layer.GOLD, table_name=self.GOLD_TABLE, paths=self.paths, mode='overwrite', partition_by='processing_date')
        count = dim.count()
        logger.info(' %d dim_products → gold/%s', count, self.GOLD_TABLE)
        return count

def main() -> None:
    logging.basicConfig(level=logging.INFO)
    DimProductsAggregator().build()
if __name__ == '__main__':
    main()