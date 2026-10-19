"""Silver + Gold layer test: deduplicate, join, aggregate.

Run after _ingest_test.py.
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

_BR = Path(__file__).parent.parent / "src/lakehouse/core/databricks_bridge.py"
_spec = importlib.util.spec_from_file_location("br", _BR)
br = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(br)

CATALOG = "workspace"


def section(title: str) -> None:
    print()
    print("=" * 60)
    print(f"  {title}")
    print("=" * 60)


def show(label: str, sql: str, n: int = 5) -> None:
    out = br.run_sql(sql)
    print(f"\n  {label}: {out['status']}, {len(out['rows'])} rows")
    if out["columns"]:
        print("    " + " | ".join(out["columns"]))
    for r in out["rows"][:n]:
        print("    " + " | ".join(str(x) for x in r))


def main() -> int:
    section("SILVER layer: customers_clean (deduped, validated)")

    br.run_sql(f"""
        CREATE OR REPLACE TABLE {CATALOG}.silver.customers_clean AS
        SELECT
            CAST(customer_id AS INT)    AS customer_id,
            TRIM(first_name)            AS first_name,
            TRIM(last_name)             AS last_name,
            LOWER(TRIM(email))          AS email,
            CAST(age AS INT)            AS age,
            CURRENT_TIMESTAMP()         AS _ingested_at
        FROM {CATALOG}.bronze.customers_test
        WHERE customer_id IS NOT NULL
          AND email LIKE '%@%'
        QUALIFY ROW_NUMBER() OVER (
            PARTITION BY customer_id ORDER BY _rescued_data
        ) = 1
    """, timeout="50s")
    show("customers_clean row count",
         f"SELECT count(*) AS n FROM {CATALOG}.silver.customers_clean")

    section("SILVER layer: orders_enriched (joined with customers)")

    br.run_sql(f"""
        CREATE OR REPLACE TABLE {CATALOG}.silver.orders_enriched AS
        SELECT
            o.order_id,
            o.customer_id,
            c.first_name || ' ' || c.last_name AS customer_name,
            o.line_total,
            o.status,
            o.order_date,
            o.line_total >= 1000           AS is_high_value
        FROM {CATALOG}.bronze.orders_test o
        LEFT JOIN {CATALOG}.silver.customers_clean c
            ON c.customer_id = o.customer_id
    """, timeout="50s")
    show("orders_enriched sample",
         f"""
         SELECT order_id, customer_id, customer_name, line_total, status, is_high_value
         FROM {CATALOG}.silver.orders_enriched
         ORDER BY line_total DESC
         LIMIT 5
         """)

    section("GOLD layer: customer_lifetime_value")

    br.run_sql(f"""
        CREATE OR REPLACE TABLE {CATALOG}.gold.customer_ltv AS
        SELECT
            c.customer_id,
            c.first_name || ' ' || c.last_name AS customer_name,
            c.email,
            COUNT(o.order_id)             AS total_orders,
            COALESCE(SUM(o.line_total), 0) AS lifetime_value,
            MAX(o.order_date)             AS last_order_date,
            MAX(CASE WHEN o.is_high_value THEN 1 ELSE 0 END) = 1
                                          AS has_high_value_order
        FROM {CATALOG}.silver.customers_clean c
        LEFT JOIN {CATALOG}.silver.orders_enriched o
            ON c.customer_id = o.customer_id
        GROUP BY c.customer_id, c.first_name, c.last_name, c.email
        ORDER BY lifetime_value DESC
    """, timeout="50s")
    show("customer_ltv (top 5 by LTV)",
         f"""
         SELECT customer_id, customer_name, total_orders,
                lifetime_value, last_order_date, has_high_value_order
         FROM {CATALOG}.gold.customer_ltv
         ORDER BY lifetime_value DESC
         LIMIT 5
         """)

    section("Final inventory")
    for layer in ("bronze", "silver", "gold"):
        out = br.run_sql(f"SHOW TABLES IN {CATALOG}.{layer}")
        if out["rows"]:
            print(f"\n  {CATALOG}.{layer}:")
            for r in out["rows"]:
                print(f"    - {r[1]}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
