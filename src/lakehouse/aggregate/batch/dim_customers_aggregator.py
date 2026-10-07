from __future__ import annotations
import logging
from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F
from lakehouse.core.constants import Layer
from lakehouse.core.paths import LakePaths
from lakehouse.core.spark import get_spark_session
from lakehouse.storage.delta_writer import write_delta_table
logger = logging.getLogger(__name__)

class DimCustomersAggregator:
    GOLD_TABLE = 'dim_customers'

    def __init__(self, spark: SparkSession | None=None, *, paths: LakePaths | None=None) -> None:
        self.spark = spark or get_spark_session('DimCustomersAggregator')
        self.paths = paths or LakePaths()

    def build(self) -> int:
        logger.info(' Build: dim_customers')
        customers = self.spark.read.format('delta').load(self.paths.silver('customers'))
        orders = self.spark.read.format('delta').load(self.paths.silver('orders'))
        customer_metrics = orders.groupBy('customer_id').agg(F.countDistinct('order_id').alias('total_orders'), F.sum('line_total').alias('total_revenue'), F.avg('line_total').alias('avg_order_value'), F.max('order_date').alias('last_order_date'), F.countDistinct('status').alias('unique_statuses'))
        dim = customers.join(customer_metrics, 'customer_id', 'left').withColumn('customer_lifetime_days', F.datediff(F.current_date(), 'last_order_date')).withColumn('customer_segment', F.when(F.col('total_revenue') >= 10000, 'VIP').when(F.col('total_revenue') >= 5000, 'Gold').when(F.col('total_revenue') >= 1000, 'Silver').otherwise('Bronze')).fillna(0, subset=['total_orders', 'total_revenue', 'avg_order_value']).withColumn('processing_date', F.date_format(F.current_timestamp(), 'yyyy-MM-dd'))
        write_delta_table(dim, layer=Layer.GOLD, table_name=self.GOLD_TABLE, paths=self.paths, mode='overwrite', partition_by='processing_date')
        count = dim.count()
        logger.info(' %d dim_customers → gold/%s', count, self.GOLD_TABLE)
        return count

def main() -> None:
    logging.basicConfig(level=logging.INFO)
    DimCustomersAggregator().build()
if __name__ == '__main__':
    main()