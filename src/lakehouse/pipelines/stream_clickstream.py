from __future__ import annotations
import logging
from lakehouse.aggregate.streaming.clickstream_metrics_aggregator import ClickstreamMetricsAggregator
from lakehouse.ingest.streaming.clickstream_ingestor import ClickstreamIngestor
from lakehouse.pipelines.base import StreamingPipeline
from lakehouse.transform.streaming.clickstream_transformer import ClickstreamTransformer
logger = logging.getLogger(__name__)

class ClickstreamStreamingPipeline(StreamingPipeline):

    @property
    def name(self) -> str:
        return 'ClickstreamStreamingPipeline'

    def queries(self) -> list:
        ingestor = ClickstreamIngestor(spark=self.spark, paths=self.paths)
        transformer = ClickstreamTransformer(spark=self.spark, paths=self.paths)
        aggregator = ClickstreamMetricsAggregator(spark=self.spark, paths=self.paths)
        return [ingestor.run(), transformer.run(), *aggregator.build()]

def main() -> None:
    logging.basicConfig(level=logging.INFO)
    pipeline = ClickstreamStreamingPipeline()
    pipeline.execute()
if __name__ == '__main__':
    main()