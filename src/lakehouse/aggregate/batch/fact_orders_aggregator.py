from __future__ import annotations
import logging
from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F
from lakehouse.core.constants import Layer
from lakehouse.core.paths import LakePaths
from lakehouse.core.spark import get_spark_session
from lakehouse.storage.delta_writer import write_delta_table
logger = logging.getLogger(__name__)

class FactOrdersAggregator:
    GOLD_TABLE = 'fact_orders'

    def __init__(self, spark: SparkSession | None=None, *, paths: LakePaths | None=None) -> None:
        self.spark = spark or get_spark_session('FactOrdersAggregator')
        self.paths = paths or LakePaths()

    def build(self) -> int:
        logger.info(' Build: fact_orders')
        orders = self.spark.read.format('delta').load(self.paths.silver('orders'))
        customers = self.spark.read.format('delta').load(self.paths.silver('customers'))
        products = self.spark.read.format('delta').load(self.paths.silver('products'))
        fact = orders.join(customers.select('customer_id', 'full_name', 'city', 'segment'), 'customer_id', 'left').join(products.select('product_id', 'product_name', 'category', 'subcategory'), 'product_id', 'left').withColumn('revenue', F.col('line_total')).withColumn('cost', F.col('line_total') * 0.6).withColumn('profit', F.col('revenue') - F.col('cost')).select('order_id', 'order_date', 'customer_id', 'full_name', 'city', 'segment', 'product_id', 'product_name', 'category', 'subcategory', 'quantity', 'unit_price', 'line_total', 'total_amount', 'revenue', 'cost', 'profit', 'status', 'payment_method', 'shipping_city').withColumn('processing_date', F.date_format(F.current_timestamp(), 'yyyy-MM-dd'))
        write_delta_table(fact, layer=Layer.GOLD, table_name=self.GOLD_TABLE, paths=self.paths, mode='overwrite', partition_by='order_date')
        count = fact.count()
        logger.info(' %d fact_orders → gold/%s', count, self.GOLD_TABLE)
        return count

def main() -> None:
    logging.basicConfig(level=logging.INFO)
    FactOrdersAggregator().build()
if __name__ == '__main__':
    main()