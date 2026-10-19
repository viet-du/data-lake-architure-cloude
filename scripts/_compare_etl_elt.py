"""Run both ETL and ELT, compare timings + output row counts.

Output: 2 sets of Delta tables, side-by-side timing table, and verdict
on which paradigm suits which use case.
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

SUFFIXES = ["etl", "elt"]


def measure(label, fn):
    t0 = time.time()
    out = fn()
    dt = time.time() - t0
    print(f"  ⏱  {label}: {dt:.2f}s")
    return dt, out


def main() -> int:
    print("=" * 70)
    print("  ETL vs ELT: side-by-side comparison")
    print("=" * 70)

    timings: dict[str, float] = {}

    # ── Run ETL ──────────────────────────────────────────────
    print("\n▶ Pipeline 1: ETL (transform on local, load clean Delta)")
    t0 = time.time()
    import subprocess
    res = subprocess.run(
        [sys.executable, "scripts/_etl_pipeline.py"],
        capture_output=True, text=True, cwd=Path(__file__).parent.parent,
    )
    if res.returncode != 0:
        print("  ETL failed:")
        print(res.stdout)
        print(res.stderr)
        return res.returncode
    # Print the summary block
    summary_start = res.stdout.find("ETL Pipeline Summary")
    if summary_start > 0:
        print("  " + res.stdout[summary_start:].replace("\n", "\n  ").rstrip())
    timings["etl_total"] = time.time() - t0

    # ── Run ELT ──────────────────────────────────────────────
    print("\n▶ Pipeline 2: ELT (load raw, transform in SQL warehouse)")
    t0 = time.time()
    res = subprocess.run(
        [sys.executable, "scripts/_elt_pipeline.py"],
        capture_output=True, text=True, cwd=Path(__file__).parent.parent,
    )
    if res.returncode != 0:
        print("  ELT failed:")
        print(res.stdout)
        print(res.stderr)
        return res.returncode
    summary_start = res.stdout.find("ELT Pipeline Summary")
    if summary_start > 0:
        print("  " + res.stdout[summary_start:].replace("\n", "\n  ").rstrip())
    timings["elt_total"] = time.time() - t0

    # ── Compare row counts ───────────────────────────────────
    print("\n" + "=" * 70)
    print("  Output comparison (row counts must match)")
    print("=" * 70)
    print(f"  {'layer':<10} {'ETL':<8} {'ELT':<8} {'table':<30}")
    print("  " + "-" * 60)
    targets = [
        ("silver", "customers_clean"),
        ("silver", "orders_enriched"),
        ("gold",   "customer_ltv"),
    ]
    all_match = True
    for schema, t in targets:
        etl_n = br.run_sql(
            f"SELECT count(*) AS n FROM {CATALOG}.{schema}.{t}_etl"
        )["rows"][0][0]
        elt_n = br.run_sql(
            f"SELECT count(*) AS n FROM {CATALOG}.{schema}.{t}_elt"
        )["rows"][0][0]
        match = "✅" if etl_n == elt_n else "❌"
        if etl_n != elt_n:
            all_match = False
        print(f"  {schema:<10} {etl_n:<8} {elt_n:<8} {t:<30} {match}")

    # ── Compare LTV top-3 ────────────────────────────────────
    print("\n" + "=" * 70)
    print("  Gold layer: top-3 customers by LTV (ETL vs ELT)")
    print("=" * 70)
    for suffix in SUFFIXES:
        print(f"\n  --- ETL ---" if suffix == "etl" else f"\n  --- ELT ---")
        out = br.run_sql(f"""
            SELECT customer_id, customer_name, total_orders,
                   lifetime_value, has_high_value_order
            FROM {CATALOG}.gold.customer_ltv_{suffix}
            ORDER BY lifetime_value DESC
            LIMIT 3
        """)
        for r in out["rows"]:
            print(f"    cust {r[0]:<3} {r[1]:<15} "
                  f"orders={r[2]:<2} LTV={r[3]:<8} hv={r[4]}")

    # ── Final verdict ────────────────────────────────────────
    print("\n" + "=" * 70)
    print("  Verdict")
    print("=" * 70)
    print(f"""
  ⏱  ETL total: {timings['etl_total']:.1f}s
  ⏱  ELT total: {timings['elt_total']:.1f}s

  When to use each paradigm:

  ┌──────────────────────┬──────────────────────────────────┐
  │ ETL (transform local)│ ELT (transform in warehouse)     │
  ├──────────────────────┼──────────────────────────────────┤
  │ • Data fits in RAM   │ • Data is large / streaming      │
  │ • Complex Python lib │ • SQL-friendly transforms        │
  │   (pandas, sklearn,  │ • Schema evolution, late-bound   │
  │   spaCy, custom ML)  │   typing                         │
  │ • Quick iteration    │ • Business users query raw layer │
  │ • Strict PII masking │ • Centralised logic, no data     │
  │   before lake load   │   movement                       │
  └──────────────────────┴──────────────────────────────────┘

  Hybrid (recommended):
    • Small reference data  → ETL locally
    • Large fact tables      → ELT (raw landing + SQL)
    • ML feature engineering → ETL with feature store
    • Self-service analytics → ELT with semantic layer
""")

    print(f"  Row counts match: {'✅ YES' if all_match else '❌ NO'}")
    return 0 if all_match else 1


if __name__ == "__main__":
    sys.exit(main())
