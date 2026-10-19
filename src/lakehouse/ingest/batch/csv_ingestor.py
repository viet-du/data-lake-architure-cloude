from __future__ import annotations

import logging
import os
from pathlib import Path

from pyspark.sql import DataFrame, SparkSession

from lakehouse.core.paths import LakePaths
from lakehouse.core.spark import get_spark_session
from lakehouse.storage.delta_writer import write_delta_table

logger = logging.getLogger(__name__)


class CsvIngestor:

    def __init__(
        self,
        spark: SparkSession | None = None,
        *,
        paths: LakePaths | None = None,
        source_dir: str | Path | None = None,
        source_name: str = "crm",
    ) -> None:
        self.spark = spark or get_spark_session("CsvIngestor")
        self.paths = paths or LakePaths()
        # Same convention as RetailMockGenerator: honor DATA_SAMPLES_DIR, then
        # fall back to <repo>/data-samples. Using a relative "data-samples"
        # here is the historical bug — the BashOperator runs from
        # /opt/airflow and there is no data-samples there.
        if source_dir is None:
            source_dir = os.environ.get("DATA_SAMPLES_DIR")
        if source_dir is None:
            source_dir = str(Path(__file__).resolve().parents[4] / "data-samples")
        self.source_dir = Path(source_dir)
        self.source_name = source_name

    def ingest_file(self, csv_path: Path, target_table: str) -> int:
        if not csv_path.exists():
            logger.warning("  %s not found, skipping", csv_path)
            return 0
        logger.info(" Ingesting %s → bronze/%s", csv_path.name, target_table)
        df: DataFrame = self.spark.read.csv(str(csv_path), header=True, inferSchema=True)
        from pyspark.sql import functions as F

        df = (
            df.withColumn("_source_file", F.lit(str(csv_path)))
            .withColumn("_ingestion_timestamp", F.current_timestamp())
            .withColumn("_ingestion_date", F.date_format(F.current_timestamp(), "yyyy-MM-dd"))
        )
        # Deduplicate by the natural key BEFORE writing.
        # The key is derived from the target table name:
        #   crm/customers  → customer_id
        #   erp/products    → product_id
        # Re-running ingest appends rows; dedup ensures duplicates don't accumulate.
        key_col = _derive_natural_key(target_table)
        if key_col and key_col in df.columns:
            df = df.dropDuplicates([key_col])
        # Estimate row count from the source CSV lines BEFORE write. This
        # avoids calling df.count() after the delta write, which forces
        # a second Spark job that can OOM the local JVM in the airflow
        # webserver's BashOperator (2GB heap). On small CSVs, the line-count
        # approximation is close enough for the "Ingested N rows" log.
        with open(csv_path, encoding="utf-8") as f:
            approx_count = max(sum(1 for _ in f) - 1, 0)
        write_delta_table(
            df,
            layer=self._layer(),
            table_name=target_table,
            paths=self.paths,
            mode="append",
            partition_by=None,
            merge_schema=True,
        )
        # Force materialization without an extra count() job. cache() + a
        # single .count() only works if memory is plentiful; instead we
        # just unpersist the dataframe so the next file can start clean.
        df.unpersist(blocking=False)
        logger.info(" Ingested ~%d rows → bronze/%s", approx_count, target_table)
        return approx_count

    def ingest_directory(self, sub_dir: str = "") -> dict[str, int]:
        search_dir = self.source_dir / sub_dir if sub_dir else self.source_dir
        if not search_dir.exists():
            logger.warning("  %s does not exist", search_dir)
            return {}
        results: dict[str, int] = {}
        # Recursive glob (rglob) so we pick up CSVs in subdirectories like
        # crm/customers.csv and erp/products.csv. The previous `glob("*.csv")`
        # only matched top-level files and silently ingested 0 rows even
        # when the data was present (this was the bug behind "Total: 0
        # files ingested" while the bronze bucket stayed empty).
        for csv_file in sorted(search_dir.rglob("*.csv")):
            rel_path = csv_file.relative_to(self.source_dir)
            target = str(rel_path.with_suffix("")).replace("\\", "/")
            count = self.ingest_file(csv_file, target)
            results[str(rel_path)] = count
        logger.info(" Total: %d files ingested", len(results))
        return results

    @staticmethod
    def _layer():
        from lakehouse.core.constants import Layer

        return Layer.BRONZE


def _derive_natural_key(target_table: str) -> str | None:
    """Derive the natural primary-key column from the target table path."""
    table_key_map = {
        "crm/customers": "customer_id",
        "erp/products": "product_id",
        "erp/orders": "order_id",
    }
    return table_key_map.get(target_table)


def main() -> None:
    import argparse

    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser(description="Ingest CSV files into the bronze layer.")
    parser.add_argument(
        "--only",
        type=str,
        default=None,
        help=(
            "Optional path relative to DATA_SAMPLES_DIR (e.g. crm/customers.csv). "
            "If provided, ingest only that one file; otherwise ingest every CSV "
            "under the source dir recursively. We use this to keep each "
            "BashOperator invocation's local Spark JVM short-lived, which is "
            "the only way the airflow webserver's BashOperator reliably "
            "finishes the delta write before the JVM is killed."
        ),
    )
    args = parser.parse_args()
    ingestor = CsvIngestor()
    if args.only:
        target = Path(ingestor.source_dir) / args.only
        rel = target.relative_to(ingestor.source_dir)
        ingestor.ingest_file(target, str(rel.with_suffix("")).replace("\\", "/"))
    else:
        ingestor.ingest_directory()


if __name__ == "__main__":
    main()
