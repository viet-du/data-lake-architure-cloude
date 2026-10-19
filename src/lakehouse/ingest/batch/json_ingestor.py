from __future__ import annotations

import logging
import os
from pathlib import Path

from pyspark.sql import DataFrame, SparkSession

from lakehouse.core.constants import Layer
from lakehouse.core.paths import LakePaths
from lakehouse.core.spark import get_spark_session
from lakehouse.storage.delta_writer import write_delta_table

logger = logging.getLogger(__name__)


class JsonIngestor:

    def __init__(
        self,
        spark: SparkSession | None = None,
        *,
        paths: LakePaths | None = None,
        source_dir: str | Path | None = None,
    ) -> None:
        self.spark = spark or get_spark_session("JsonIngestor")
        self.paths = paths or LakePaths()
        # Same convention as CsvIngestor: DATA_SAMPLES_DIR env first, then
        # absolute path under the repo. This avoids the BashOperator's
        # /opt/airflow cwd swallowing the source directory.
        if source_dir is None:
            source_dir = os.environ.get("DATA_SAMPLES_DIR")
        if source_dir is None:
            source_dir = str(Path(__file__).resolve().parents[4] / "data-samples")
        self.source_dir = Path(source_dir)

    def ingest_file(self, json_path: Path, target_table: str, multiline: bool = True) -> int:
        if not json_path.exists():
            logger.warning("  %s not found", json_path)
            return 0
        logger.info(" Ingesting %s → bronze/%s", json_path.name, target_table)
        df: DataFrame = self.spark.read.json(str(json_path), multiLine=multiline)
        from pyspark.sql import functions as F

        df = (
            df.withColumn("_source_file", F.lit(str(json_path)))
            .withColumn("_ingestion_timestamp", F.current_timestamp())
            .withColumn("_ingestion_date", F.date_format(F.current_timestamp(), "yyyy-MM-dd"))
        )
        # Deduplicate by the natural key BEFORE writing (same as CsvIngestor).
        key_col = _derive_natural_key(target_table)
        if key_col and key_col in df.columns:
            df = df.dropDuplicates([key_col])
        # Estimate row count from raw bytes (one record per line) to avoid
        # an extra Spark job that OOMs the airflow webserver JVM. The exact
        # count is not used downstream.
        with open(json_path, encoding="utf-8") as f:
            approx_count = max(sum(1 for _ in f) - 2, 0)  # json is "[\n  {...},\n  ...]"
        write_delta_table(
            df,
            layer=Layer.BRONZE,
            table_name=target_table,
            paths=self.paths,
            mode="append",
            partition_by=None,
            merge_schema=True,
        )
        df.unpersist(blocking=False)
        logger.info(" Ingested ~%d rows → bronze/%s", approx_count, target_table)
        return approx_count


def _derive_natural_key(target_table: str) -> str | None:
    """Derive the natural primary-key column from the target table path."""
    table_key_map = {
        "crm/customers": "customer_id",
        "erp/products": "product_id",
        "erp/orders": "order_id",
    }
    return table_key_map.get(target_table)


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    ingestor = JsonIngestor()
    search_dir = ingestor.source_dir
    for json_file in sorted(search_dir.rglob("*.json")):
        rel = json_file.relative_to(search_dir).with_suffix("")
        ingestor.ingest_file(json_file, str(rel).replace("\\", "/"))


if __name__ == "__main__":
    main()
