"""Mirror curated Gold Delta tables into PostgreSQL for Metabase reporting."""
from __future__ import annotations

import logging
import os

from delta.tables import DeltaTable

from lakehouse.core.paths import LakePaths
from lakehouse.core.spark import get_spark_session

logger = logging.getLogger(__name__)

GOLD_TABLES = ("fact_orders", "daily_revenue", "dim_customers", "dim_products")


def sync_gold_tables() -> None:
    paths = LakePaths()
    if paths.is_databricks:
        raise ValueError("Gold-to-PostgreSQL sync expects object-storage Delta paths, not Databricks.")

    host = os.getenv("GOLD_POSTGRES_HOST", "gold-postgres")
    port = os.getenv("GOLD_POSTGRES_PORT", "5432")
    database = os.getenv("GOLD_POSTGRES_DB", "gold_analytics")
    user = os.getenv("GOLD_POSTGRES_USER", "metabase")
    password = os.getenv("GOLD_POSTGRES_PASSWORD", "lakehouse-local")
    jdbc_url = f"jdbc:postgresql://{host}:{port}/{database}"

    spark = get_spark_session("SyncGoldToPostgres")
    try:
        for table_name in GOLD_TABLES:
            delta_path = paths.gold(table_name)
            if not DeltaTable.isDeltaTable(spark, delta_path):
                raise FileNotFoundError(
                    f"Gold Delta table {table_name!r} was not found at {delta_path}"
                )

            dataframe = spark.read.format("delta").load(delta_path)
            row_count = dataframe.count()
            (
                dataframe.write.format("jdbc")
                .option("url", jdbc_url)
                .option("dbtable", f"public.{table_name}")
                .option("user", user)
                .option("password", password)
                .option("driver", "org.postgresql.Driver")
                .option("batchsize", "1000")
                .mode("overwrite")
                .save()
            )
            logger.info("Mirrored %s rows from Gold/%s to PostgreSQL", row_count, table_name)
    finally:
        spark.stop()


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    sync_gold_tables()


if __name__ == "__main__":
    main()
