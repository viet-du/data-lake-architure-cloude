"""ETL paradigm: Extract → Transform (local pandas) → Load (Delta clean).

This script:
1. Downloads CSVs from Databricks Volume via warehouse query
2. Transforms data LOCALLY with pandas (dedup, validate, enrich)
3. Writes the CLEANED data straight to silver/gold Delta tables

Use case: data is small/medium, business logic is complex (Python libs,
ML features), and you want full control over transformations.
"""
from __future__ import annotations

import importlib.util
import sys
import time
from pathlib import Path

# Load bridge
_BR = Path(__file__).parent.parent / "src/lakehouse/core/databricks_bridge.py"
_spec = importlib.util.spec_from_file_location("br", _BR)
br = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(br)

CATALOG = "workspace"
VOL = f"/Volumes/{CATALOG}/bronze/bronze_data"
SILVER = f"{CATALOG}.silver"
GOLD = f"{CATALOG}.gold"


def _load_csv_from_volume(path: str) -> "pd.DataFrame":
    """Read a CSV from a Databricks Volume using the SQL warehouse."""
    import pandas as pd
    out = br.run_sql(
        f"SELECT * FROM read_files('{path}', format => 'csv', header => true)"
    )
    if not out["rows"]:
        return pd.DataFrame(columns=out["columns"])
    return pd.DataFrame(out["rows"], columns=out["columns"])


def _write_df_to_delta(df, table: str) -> None:
    """
    Write a pandas DataFrame to a Delta table using the warehouse.

    Pattern: CREATE OR REPLACE TABLE AS SELECT * FROM VALUES (...) where
    values are bound from pandas rows. This is fast for small/medium DFs
    (≤ 100k rows) because the warehouse is optimised for bulk INSERT.
    """
    if df.empty:
        # Just create an empty table matching the schema
        cols_sql = ", ".join(f"{c} STRING" for c in df.columns)
        br.run_sql(f"CREATE OR REPLACE TABLE {table} ({cols_sql}) USING DELTA")
        return

    cols = list(df.columns)
    quoted_cols = ", ".join(f"`{c}`" for c in cols)

    # Build VALUES clause: each row cast to a literal via %s
    values = []
    for _, row in df.iterrows():
        cells = []
        for c in cols:
            v = row[c]
            if v is None or (isinstance(v, float) and v != v):  # NaN
                cells.append("NULL")
            elif isinstance(v, (int,)):
                cells.append(str(v))
            elif isinstance(v, float):
                cells.append(repr(float(v)))
            else:
                s = str(v).replace("'", "''")
                cells.append(f"'{s}'")
        values.append(f"({', '.join(cells)})")
    values_sql = ", ".join(values)

    # Type hints: rely on Delta auto-inference from literal values
    sql = f"""
        CREATE OR REPLACE TABLE {table}
        USING DELTA
        AS SELECT {quoted_cols} FROM VALUES {values_sql} AS t({quoted_cols})
    """
    br.run_sql(sql, timeout="50s")


def main() -> int:
    print("=" * 60)
    print("  ETL: Transform on local → Load clean Delta")
    print("=" * 60)

    timings: dict[str, float] = {}
    t_total = time.time()

    # ── EXTRACT ────────────────────────────────────────────────
    t0 = time.time()
    print("\n[1/4] EXTRACT: read CSVs from Volume via warehouse")
    customers_pdf = _load_csv_from_volume(f"{VOL}/customers_test.csv")
    orders_pdf = _load_csv_from_volume(f"{VOL}/orders_test.csv")
    timings["extract"] = time.time() - t0
    print(f"  customers: {len(customers_pdf)} rows, {len(customers_pdf.columns)} cols")
    print(f"  orders:    {len(orders_pdf)} rows, {len(orders_pdf.columns)} cols")
    print(f"  ⏱  {timings['extract']:.2f}s")

    # ── TRANSFORM (local pandas) ──────────────────────────────
    t0 = time.time()
    print("\n[2/4] TRANSFORM (local pandas): dedup, validate, enrich")

    # Bronze→Silver: customers_clean
    import pandas as pd
    customers_pdf["customer_id"] = customers_pdf["customer_id"].astype(int)
    customers_pdf["age"] = customers_pdf["age"].astype(int)
    customers_pdf["email"] = customers_pdf["email"].str.strip().str.lower()
    customers_pdf["first_name"] = customers_pdf["first_name"].str.strip()
    customers_pdf["last_name"] = customers_pdf["last_name"].str.strip()
    # Validate: must have @ in email
    valid = customers_pdf["email"].str.contains("@", na=False)
    # Dedup on customer_id (keep first)
    customers_pdf = customers_pdf[valid].drop_duplicates(
        subset=["customer_id"], keep="first"
    ).reset_index(drop=True)
    customers_pdf["_ingested_at"] = pd.Timestamp.utcnow()
    print(f"  customers_clean: {len(customers_pdf)} rows after dedup+validate")

    # Bronze→Silver: orders_enriched
    orders_pdf["order_id"] = orders_pdf["order_id"].astype(int)
    orders_pdf["customer_id"] = orders_pdf["customer_id"].astype(int)
    orders_pdf["line_total"] = orders_pdf["line_total"].astype(float)
    # join with cleaned customers
    joined = orders_pdf.merge(
        customers_pdf[["customer_id", "first_name", "last_name"]],
        on="customer_id", how="left"
    )
    joined["customer_name"] = (
        joined["first_name"].fillna("") + " " + joined["last_name"].fillna("")
    ).str.strip()
    joined["is_high_value"] = joined["line_total"] >= 1000
    orders_enriched = joined[[
        "order_id", "customer_id", "customer_name",
        "line_total", "status", "order_date", "is_high_value"
    ]]
    print(f"  orders_enriched: {len(orders_enriched)} rows after join+enrich")

    # Silver→Gold: customer_ltv
    ltv = orders_enriched.groupby(
        ["customer_id", "customer_name"], as_index=False
    ).agg(
        total_orders=("order_id", "count"),
        lifetime_value=("line_total", "sum"),
        last_order_date=("order_date", "max"),
    )
    high_value_per_cust = orders_enriched.groupby("customer_id")["is_high_value"].max()
    ltv["has_high_value_order"] = ltv["customer_id"].map(high_value_per_cust).fillna(False)
    ltv = ltv.sort_values("lifetime_value", ascending=False).reset_index(drop=True)
    print(f"  customer_ltv: {len(ltv)} rows aggregated")
    timings["transform_local"] = time.time() - t0
    print(f"  ⏱  {timings['transform_local']:.4f}s (local CPU)")

    # ── LOAD (clean → Delta) ──────────────────────────────────
    t0 = time.time()
    print("\n[3/4] LOAD: write clean Delta tables (one row at a time via VALUES)")

    _write_df_to_delta(customers_pdf, f"{SILVER}.customers_clean_etl")
    print(f"  ✅ {SILVER}.customers_clean_etl")

    _write_df_to_delta(orders_enriched, f"{SILVER}.orders_enriched_etl")
    print(f"  ✅ {SILVER}.orders_enriched_etl")

    _write_df_to_delta(ltv, f"{GOLD}.customer_ltv_etl")
    print(f"  ✅ {GOLD}.customer_ltv_etl")
    timings["load_clean"] = time.time() - t0
    print(f"  ⏱  {timings['load_clean']:.2f}s")

    # ── VERIFY ────────────────────────────────────────────────
    t0 = time.time()
    print("\n[4/4] VERIFY: read back from Delta")
    for t in ("customers_clean_etl", "orders_enriched_etl", "customer_ltv_etl"):
        schema_name = "gold" if "ltv" in t else "silver"
        out = br.run_sql(
            f"SELECT count(*) AS n FROM {CATALOG}.{schema_name}.{t}"
        )
        n = out["rows"][0][0]
        print(f"  ✅ {schema_name}.{t} = {n} rows")
    timings["verify"] = time.time() - t0
    timings["total"] = time.time() - t_total
    print(f"  ⏱  {timings['verify']:.2f}s")

    # ── Summary ───────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("  ETL Pipeline Summary")
    print("=" * 60)
    for k, v in timings.items():
        print(f"  {k:<20} {v:>8.3f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
