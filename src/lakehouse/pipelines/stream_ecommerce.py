from __future__ import annotations
import logging
from lakehouse.aggregate.streaming.ecommerce_metrics_aggregator import EcommerceMetricsAggregator
from lakehouse.ingest.streaming.ecommerce_ingestor import EcommerceIngestor
from lakehouse.pipelines.base import StreamingPipeline
from lakehouse.transform.streaming.ecommerce_transformer import EcommerceTransformer
logger = logging.getLogger(__name__)

class EcommerceStreamingPipeline(StreamingPipeline):

    @property
    def name(self) -> str:
        return 'EcommerceStreamingPipeline'

    def queries(self) -> list:
        ingestor = EcommerceIngestor(spark=self.spark, paths=self.paths)
        transformer = EcommerceTransformer(spark=self.spark, paths=self.paths)
        aggregator = EcommerceMetricsAggregator(spark=self.spark, paths=self.paths)
        return [*ingestor.run(), *transformer.run(), *aggregator.build()]

def main() -> None:
    logging.basicConfig(level=logging.INFO)
    pipeline = EcommerceStreamingPipeline()
    pipeline.execute()
if __name__ == '__main__':
    main()