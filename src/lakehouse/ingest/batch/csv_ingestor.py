from __future__ import annotations
import logging
from pathlib import Path
from pyspark.sql import DataFrame, SparkSession
from lakehouse.core.paths import LakePaths
from lakehouse.core.spark import get_spark_session
from lakehouse.storage.delta_writer import write_delta_table
logger = logging.getLogger(__name__)

class CsvIngestor:

    def __init__(self, spark: SparkSession | None=None, *, paths: LakePaths | None=None, source_dir: str | Path='data-samples', source_name: str='crm') -> None:
        self.spark = spark or get_spark_session('CsvIngestor')
        self.paths = paths or LakePaths()
        self.source_dir = Path(source_dir)
        self.source_name = source_name

    def ingest_file(self, csv_path: Path, target_table: str) -> int:
        if not csv_path.exists():
            logger.warning('  %s not found, skipping', csv_path)
            return 0
        logger.info(' Ingesting %s → bronze/%s', csv_path.name, target_table)
        df: DataFrame = self.spark.read.csv(str(csv_path), header=True, inferSchema=True)
        from pyspark.sql import functions as F
        df = df.withColumn('_source_file', F.lit(str(csv_path))).withColumn('_ingestion_timestamp', F.current_timestamp()).withColumn('_ingestion_date', F.date_format(F.current_timestamp(), 'yyyy-MM-dd'))
        write_delta_table(df, layer=self._layer(), table_name=target_table, paths=self.paths, mode='append', partition_by=None, merge_schema=True)
        count = df.count()
        logger.info(' Ingested %d rows → bronze/%s', count, target_table)
        return count

    def ingest_directory(self, sub_dir: str='') -> dict[str, int]:
        search_dir = self.source_dir / sub_dir if sub_dir else self.source_dir
        if not search_dir.exists():
            logger.warning('  %s does not exist', search_dir)
            return {}
        results: dict[str, int] = {}
        for csv_file in sorted(search_dir.glob('*.csv')):
            rel_path = csv_file.relative_to(self.source_dir)
            target = str(rel_path.with_suffix(''))
            count = self.ingest_file(csv_file, target)
            results[csv_file.name] = count
        logger.info(' Total: %d files ingested', len(results))
        return results

    @staticmethod
    def _layer():
        from lakehouse.core.constants import Layer
        return Layer.BRONZE

def main() -> None:
    logging.basicConfig(level=logging.INFO)
    ingestor = CsvIngestor()
    ingestor.ingest_directory()
if __name__ == '__main__':
    main()