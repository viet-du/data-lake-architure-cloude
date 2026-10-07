from __future__ import annotations
import logging
from dataclasses import dataclass
from lakehouse.aggregate.batch.daily_revenue_aggregator import DailyRevenueAggregator
from lakehouse.aggregate.batch.dim_customers_aggregator import DimCustomersAggregator
from lakehouse.aggregate.batch.dim_products_aggregator import DimProductsAggregator
from lakehouse.aggregate.batch.fact_orders_aggregator import FactOrdersAggregator
from lakehouse.ingest.batch.csv_ingestor import CsvIngestor
from lakehouse.ingest.batch.json_ingestor import JsonIngestor
from lakehouse.pipelines.base import BatchPipeline
from lakehouse.transform.batch.customers_transformer import CustomersTransformer
from lakehouse.transform.batch.orders_transformer import OrdersTransformer
from lakehouse.transform.batch.products_transformer import ProductsTransformer
logger = logging.getLogger(__name__)

@dataclass
class Stage:
    name: str
    runner: object

    def execute(self) -> None:
        logger.info('▶  Stage: %s', self.name)
        if hasattr(self.runner, 'transform'):
            self.runner.transform()
        elif hasattr(self.runner, 'build'):
            self.runner.build()
        elif hasattr(self.runner, 'ingest_directory'):
            self.runner.ingest_directory()

class BatchRetailPipeline(BatchPipeline):

    @property
    def name(self) -> str:
        return 'BatchRetailPipeline'

    def stages(self) -> list[Stage]:
        return [Stage('bronze.ingest_csv', CsvIngestor(source_name='crm')), Stage('bronze.ingest_json', JsonIngestor()), Stage('silver.transform_customers', CustomersTransformer()), Stage('silver.transform_products', ProductsTransformer()), Stage('silver.transform_orders', OrdersTransformer()), Stage('gold.aggregate_fact_orders', FactOrdersAggregator()), Stage('gold.aggregate_dim_customers', DimCustomersAggregator()), Stage('gold.aggregate_dim_products', DimProductsAggregator()), Stage('gold.aggregate_daily_revenue', DailyRevenueAggregator())]

def main() -> None:
    logging.basicConfig(level=logging.INFO)
    pipeline = BatchRetailPipeline()
    pipeline.execute()
if __name__ == '__main__':
    main()