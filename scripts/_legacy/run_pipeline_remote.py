"""
run_pipeline_remote.py

Run the full lakehouse pipeline from your local machine.
Execution happens on Databricks cluster; data persists in UC Volumes.
No heavy compute on your local machine.

Usage:
    # Full pipeline
    python scripts/run_pipeline_remote.py

    # One layer only
    python scripts/run_pipeline_remote.py --layer silver
    python scripts/run_pipeline_remote.py --layer gold

    # Single transformer
    python scripts/run_pipeline_remote.py --transformer CustomersTransformer
    python scripts/run_pipeline_remote.py --transformer OrdersTransformer
    python scripts/run_pipeline_remote.py --transformer DimCustomersAggregator

    # Smoke test (no cluster needed to verify setup)
    python scripts/run_pipeline_remote.py --smoke-test

Requirements:
    pip install databricks-sdk
    python scripts/configure_databricks.py --write \
        --host https://community.cloud.databricks.com \
        --token <token> \
        --cluster <cluster_id>
"""
from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from lakehouse.core.databricks_bridge import remote_spark, is_databricks_connect_available
from lakehouse.core.spark import get_spark_session
from lakehouse.core.paths import LakePaths
from lakehouse.core.env import get_storage_env
from lakehouse.core.constants import Layer
from lakehouse.transform.batch.customers_transformer import CustomersTransformer
from lakehouse.transform.batch.orders_transformer import OrdersTransformer
from lakehouse.aggregate.batch.dim_customers_aggregator import DimCustomersAggregator

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
log = logging.getLogger("pipeline.remote")


def _get_remote_spark(app_name: str):
    """Create a Spark session that routes to Databricks cluster."""
    if not is_databricks_connect_available():
        raise RuntimeError(
            "databricks-connect not configured.\n"
            "  pip install databricks-connect==15.4.*\n"
            "  databricks-connect configure\n"
        )
    return remote_spark(app_name)


def run_bronze(spark, paths: LakePaths) -> dict[str, int]:
    log.info("=" * 60)
    log.info("  BRONZE LAYER")
    log.info("=" * 60)
    counts = {}

    # bronze/crm/customers
    bronze_c = paths.bronze("crm/customers")
    if _table_exists(spark, bronze_c):
        cnt = spark.read.format("delta").load(bronze_c).count()
        log.info("  bronze/crm/customers already exists: %d rows (skip)", cnt)
        counts["bronze_crm_customers"] = cnt
    else:
        log.warning("  bronze/crm/customers not found. Run notebook to ingest first.")

    # bronze/erp/orders
    bronze_o = paths.bronze("erp/orders")
    if _table_exists(spark, bronze_o):
        cnt = spark.read.format("delta").load(bronze_o).count()
        log.info("  bronze/erp/orders already exists: %d rows (skip)", cnt)
        counts["bronze_erp_orders"] = cnt
    else:
        log.warning("  bronze/erp/orders not found. Run notebook to ingest first.")

    return counts


def run_silver(spark, paths: LakePaths) -> dict[str, int]:
    log.info("=" * 60)
    log.info("  SILVER LAYER")
    log.info("=" * 60)
    counts = {}

    log.info("  Running CustomersTransformer...")
    t = CustomersTransformer(spark=spark, paths=paths)
    cnt = t.transform()
    counts["silver_customers"] = cnt
    log.info("  ✅ silver/customers: %d rows", cnt)

    log.info("  Running OrdersTransformer...")
    t2 = OrdersTransformer(spark=spark, paths=paths)
    cnt2 = t2.transform()
    counts["silver_orders"] = cnt2
    log.info("  ✅ silver/orders: %d rows", cnt2)

    return counts


def run_gold(spark, paths: LakePaths) -> dict[str, int]:
    log.info("=" * 60)
    log.info("  GOLD LAYER")
    log.info("=" * 60)
    counts = {}

    log.info("  Running DimCustomersAggregator...")
    agg = DimCustomersAggregator(spark=spark, paths=paths)
    cnt = agg.build()
    counts["gold_dim_customers"] = cnt
    log.info("  ✅ gold/dim_customers: %d rows", cnt)

    return counts


def _table_exists(spark, path: str) -> bool:
    try:
        spark.read.format("delta").load(path).count()
        return True
    except Exception:
        return False


def _show_summary(spark, paths: LakePaths) -> None:
    log.info("=" * 60)
    log.info("  PIPELINE SUMMARY")
    log.info("=" * 60)
    checks = [
        ("bronze", "crm/customers",  paths.bronze("crm/customers")),
        ("bronze", "erp/orders",    paths.bronze("erp/orders")),
        ("silver", "customers",       paths.silver("customers")),
        ("silver", "orders",          paths.silver("orders")),
        ("gold",   "dim_customers",   paths.gold("dim_customers")),
    ]
    for layer, name, path in checks:
        try:
            cnt = spark.read.format("delta").load(path).count()
            log.info("  %s/%-20s %4d rows  ✅", layer, name, cnt)
        except Exception as e:
            log.info("  %s/%-20s    NO DATA ❌ (%s)", layer, name, type(e).__name__)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run lakehouse pipeline on Databricks from local")
    parser.add_argument("--layer", choices=["bronze", "silver", "gold"], default=None)
    parser.add_argument("--transformer", dest="transformer", default=None,
                        choices=["CustomersTransformer", "OrdersTransformer",
                                 "DimCustomersAggregator"])
    parser.add_argument("--smoke-test", dest="smoke_test", action="store_true")
    args = parser.parse_args()

    if args.smoke_test:
        from lakehouse.core.databricks_bridge import smoke_test
        smoke_test()
        return

    if not is_databricks_connect_available():
        log.error("databricks-connect not configured.")
        log.error("  pip install databricks-connect==15.4.*  (Python < 3.14)")
        log.error("    OR  pip install databricks-sdk       (any Python)")
        log.error("  Then run:")
        log.error("    python scripts/configure_databricks.py --write \\")
        log.error("        --host https://community.cloud.databricks.com \\")
        log.error("        --token dapi... \\")
        log.error("        --cluster 0123-456789-abcdefgh")
        sys.exit(1)

    with _get_remote_spark("LocalPipelineRunner") as spark:
        paths = LakePaths()
        log.info("Target: %s", paths.bronze(""))
        log.info("Catalog: %s", paths.catalog)

        results: dict[str, int] = {}

        if args.transformer:
            if args.transformer == "CustomersTransformer":
                results["silver_customers"] = CustomersTransformer(spark=spark, paths=paths).transform()
            elif args.transformer == "OrdersTransformer":
                results["silver_orders"] = OrdersTransformer(spark=spark, paths=paths).transform()
            elif args.transformer == "DimCustomersAggregator":
                results["gold_dim_customers"] = DimCustomersAggregator(spark=spark, paths=paths).build()
            log.info("✅ %s done: %s", args.transformer, results)
        elif args.layer:
            if args.layer == "bronze":
                results = run_bronze(spark, paths)
            elif args.layer == "silver":
                results = run_silver(spark, paths)
            elif args.layer == "gold":
                results = run_gold(spark, paths)
        else:
            log.info("Running full pipeline (bronze → silver → gold)...")
            run_bronze(spark, paths)
            run_silver(spark, paths)
            run_gold(spark, paths)

        _show_summary(spark, paths)
        log.info("🎉 Pipeline run complete!")


if __name__ == "__main__":
    main()
