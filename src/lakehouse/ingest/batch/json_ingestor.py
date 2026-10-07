from __future__ import annotations
import logging
from pathlib import Path
from pyspark.sql import DataFrame, SparkSession
from lakehouse.core.constants import Layer
from lakehouse.core.paths import LakePaths
from lakehouse.core.spark import get_spark_session
from lakehouse.storage.delta_writer import write_delta_table
logger = logging.getLogger(__name__)

class JsonIngestor:

    def __init__(self, spark: SparkSession | None=None, *, paths: LakePaths | None=None, source_dir: str | Path='data-samples') -> None:
        self.spark = spark or get_spark_session('JsonIngestor')
        self.paths = paths or LakePaths()
        self.source_dir = Path(source_dir)

    def ingest_file(self, json_path: Path, target_table: str, multiline: bool=True) -> int:
        if not json_path.exists():
            logger.warning('  %s not found', json_path)
            return 0
        logger.info(' Ingesting %s → bronze/%s', json_path.name, target_table)
        df: DataFrame = self.spark.read.json(str(json_path), multiLine=multiline)
        from pyspark.sql import functions as F
        df = df.withColumn('_source_file', F.lit(str(json_path))).withColumn('_ingestion_timestamp', F.current_timestamp()).withColumn('_ingestion_date', F.date_format(F.current_timestamp(), 'yyyy-MM-dd'))
        write_delta_table(df, layer=Layer.BRONZE, table_name=target_table, paths=self.paths, mode='append', partition_by=None, merge_schema=True)
        count = df.count()
        logger.info(' Ingested %d rows → bronze/%s', count, target_table)
        return count

def main() -> None:
    logging.basicConfig(level=logging.INFO)
    ingestor = JsonIngestor()
    for json_file in Path('data-samples').rglob('*.json'):
        rel = json_file.relative_to('data-samples').with_suffix('')
        ingestor.ingest_file(json_file, str(rel))
if __name__ == '__main__':
    main()