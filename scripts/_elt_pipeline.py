"""ELT paradigm: Extract → Load (raw) → Transform (SQL in warehouse).

This script:
1. Reads CSVs from Volume (raw)
2. Loads them VERBATIM into a `raw_elt` Delta table (Bronze raw landing)
3. Runs SQL transformations in the warehouse to build Silver + Gold

Use case: data is large, schema is evolving, or business wants to query
the raw layer directly. SQL is the transformation language.
"""
from __future__ import annotations

import importlib.util
import sys
import time
from pathlib import Path

_BR = Path(__file__).parent.parent / "src/lakehouse/core/databricks_bridge.py"
_spec = importlib.util.spec_from_file_location("br", _BR)
br = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(br)

CATALOG = "workspace"
VOL = f"/Volumes/{CATALOG}/bronze/bronze_data"


def main() -> int:
    print("=" * 60)
    print("  ELT: Load raw → Transform in SQL warehouse")
    print("=" * 60)

    timings: dict[str, float] = {}
    t_total = time.time()

    # ── EXTRACT (raw bytes) ─────────────────────────────────
    t0 = time.time()
    print("\n[1/4] EXTRACT: read raw CSVs from Volume (no transform)")

    # We use a SQL CREATE TABLE AS SELECT FROM read_files to land raw data.
    # Notice: schema is inferred by read_files (with all its quirks).
    print("  source paths:")
    print(f"    {VOL}/customers_test.csv")
    print(f"    {VOL}/orders_test.csv")
    timings["extract"] = time.time() - t0
    print(f"  ⏱  {timings['extract']:.4f}s (trivial — just listing)")

    # ── LOAD (raw landing) ──────────────────────────────────
    t0 = time.time()
    print("\n[2/4] LOAD RAW: write verbatim to `raw_elt` schema")

    # 2a) raw customers: dump everything as-is from CSV
    br.run_sql(f"""
        CREATE OR REPLACE TABLE {CATALOG}.raw_elt.customers_raw AS
        SELECT
            *,
            '{VOL}/customers_test.csv' AS _source_file,
            current_timestamp()        AS _loaded_at
        FROM read_files(
            '{VOL}/customers_test.csv',
            format => 'csv', header => true, mode => 'FAILFAST'
        )
    """, timeout="50s")
    print(f"  ✅ {CATALOG}.raw_elt.customers_raw")

    # 2b) raw orders
    br.run_sql(f"""
        CREATE OR REPLACE TABLE {CATALOG}.raw_elt.orders_raw AS
        SELECT
            *,
            '{VOL}/orders_test.csv' AS _source_file,
            current_timestamp()        AS _loaded_at
        FROM read_files(
            '{VOL}/orders_test.csv',
            format => 'csv', header => true, mode => 'FAILFAST'
        )
    """, timeout="50s")
    print(f"  ✅ {CATALOG}.raw_elt.orders_raw")
    timings["load_raw"] = time.time() - t0
    print(f"  ⏱  {timings['load_raw']:.2f}s")

    # ── TRANSFORM (SQL) ─────────────────────────────────────
    t0 = time.time()
    print("\n[3/4] TRANSFORM (SQL): silver + gold views on raw")

    # 3a) silver: customers_clean (deduped + validated)
    br.run_sql(f"""
        CREATE OR REPLACE TABLE {CATALOG}.silver.customers_clean_elt AS
        SELECT
            CAST(customer_id AS INT) AS customer_id,
            TRIM(first_name)         AS first_name,
            TRIM(last_name)          AS last_name,
            LOWER(TRIM(email))       AS email,
            CAST(age AS INT)         AS age,
            _loaded_at               AS _ingested_at
        FROM {CATALOG}.raw_elt.customers_raw
        WHERE customer_id IS NOT NULL
          AND email LIKE '%@%'
        QUALIFY ROW_NUMBER() OVER (
            PARTITION BY customer_id ORDER BY _rescued_data
        ) = 1
    """, timeout="50s")
    print(f"  ✅ {CATALOG}.silver.customers_clean_elt")

    # 3b) silver: orders_enriched (joined with customers)
    br.run_sql(f"""
        CREATE OR REPLACE TABLE {CATALOG}.silver.orders_enriched_elt AS
        SELECT
            o.order_id,
            o.customer_id,
            c.first_name || ' ' || c.last_name AS customer_name,
            o.line_total,
            o.status,
            o.order_date,
            o.line_total >= 1000              AS is_high_value
        FROM {CATALOG}.raw_elt.orders_raw o
        LEFT JOIN {CATALOG}.silver.customers_clean_elt c
            ON c.customer_id = o.customer_id
    """, timeout="50s")
    print(f"  ✅ {CATALOG}.silver.orders_enriched_elt")

    # 3c) gold: customer_ltv (aggregated)
    br.run_sql(f"""
        CREATE OR REPLACE TABLE {CATALOG}.gold.customer_ltv_elt AS
        SELECT
            c.customer_id,
            c.first_name || ' ' || c.last_name AS customer_name,
            c.email,
            COUNT(o.order_id)              AS total_orders,
            COALESCE(SUM(o.line_total), 0) AS lifetime_value,
            MAX(o.order_date)              AS last_order_date,
            MAX(CASE WHEN o.is_high_value THEN 1 ELSE 0 END) = 1
                                           AS has_high_value_order
        FROM {CATALOG}.silver.customers_clean_elt c
        LEFT JOIN {CATALOG}.silver.orders_enriched_elt o
            ON c.customer_id = o.customer_id
        GROUP BY c.customer_id, c.first_name, c.last_name, c.email
        ORDER BY lifetime_value DESC
    """, timeout="50s")
    print(f"  ✅ {CATALOG}.gold.customer_ltv_elt")
    timings["transform_sql"] = time.time() - t0
    print(f"  ⏱  {timings['transform_sql']:.2f}s")

    # ── VERIFY ───────────────────────────────────────────────
    t0 = time.time()
    print("\n[4/4] VERIFY: count rows in each table")
    for s, t in [
        ("raw_elt", "customers_raw"),
        ("raw_elt", "orders_raw"),
        ("silver",  "customers_clean_elt"),
        ("silver",  "orders_enriched_elt"),
        ("gold",    "customer_ltv_elt"),
    ]:
        out = br.run_sql(f"SELECT count(*) AS n FROM {CATALOG}.{s}.{t}")
        n = out["rows"][0][0]
        print(f"  ✅ {s}.{t} = {n} rows")
    timings["verify"] = time.time() - t0
    timings["total"] = time.time() - t_total
    print(f"  ⏱  {timings['verify']:.2f}s")

    # ── Summary ──────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("  ELT Pipeline Summary")
    print("=" * 60)
    for k, v in timings.items():
        print(f"  {k:<20} {v:>8.3f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
