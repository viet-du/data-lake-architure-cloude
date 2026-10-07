from __future__ import annotations
import logging
from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F
from lakehouse.core.constants import Layer
from lakehouse.core.paths import LakePaths
from lakehouse.core.spark import get_spark_session
from lakehouse.storage.delta_writer import write_delta_table
logger = logging.getLogger(__name__)

class DailyRevenueAggregator:
    GOLD_TABLE = 'daily_revenue'

    def __init__(self, spark: SparkSession | None=None, *, paths: LakePaths | None=None) -> None:
        self.spark = spark or get_spark_session('DailyRevenueAggregator')
        self.paths = paths or LakePaths()

    def build(self) -> int:
        logger.info(' Build: daily_revenue')
        orders = self.spark.read.format('delta').load(self.paths.silver('orders'))
        daily = orders.filter(F.col('status') == 'completed').groupBy('order_date').agg(F.countDistinct('order_id').alias('orders_count'), F.countDistinct('customer_id').alias('customers_count'), F.sum('line_total').alias('total_revenue'), F.avg('line_total').alias('avg_order_value'), F.sum(F.when(F.col('payment_method') == 'COD', 1).otherwise(0)).alias('cod_orders')).withColumn('processing_date', F.date_format(F.current_timestamp(), 'yyyy-MM-dd'))
        write_delta_table(daily, layer=Layer.GOLD, table_name=self.GOLD_TABLE, paths=self.paths, mode='overwrite', partition_by='order_date')
        count = daily.count()
        logger.info(' %d daily_revenue rows → gold/%s', count, self.GOLD_TABLE)
        return count

def main() -> None:
    logging.basicConfig(level=logging.INFO)
    DailyRevenueAggregator().build()
if __name__ == '__main__':
    main()