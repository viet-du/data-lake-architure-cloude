"""End-to-end ingest test: CSV in Volume → Delta table → read back.

Run:
    python scripts/_ingest_test.py
"""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

_BR = Path(__file__).parent.parent / "src/lakehouse/core/databricks_bridge.py"
_spec = importlib.util.spec_from_file_location("br", _BR)
br = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(br)

CATALOG = "workspace"
SCHEMA = "bronze"
VOL = f"/Volumes/{CATALOG}/{SCHEMA}/bronze_data"

JOBS = [
    {
        "csv": f"{VOL}/customers_test.csv",
        "table": f"{CATALOG}.{SCHEMA}.customers_test",
    },
    {
        "csv": f"{VOL}/orders_test.csv",
        "table": f"{CATALOG}.{SCHEMA}.orders_test",
    },
]


def main() -> int:
    print("=" * 60)
    print("  Ingest Test: CSV → Delta (Unity Catalog)")
    print("=" * 60)

    for job in JOBS:
        print(f"\n▶ {job['csv']}")
        print(f"  → {job['table']}")

        # 1) Create-or-replace Delta table from CSV using read_files
        sql = f"""
            CREATE OR REPLACE TABLE {job['table']}
            USING DELTA
            AS SELECT * FROM read_files(
                '{job['csv']}',
                format => 'csv',
                header => true,
                mode => 'FAILFAST'
            )
        """
        try:
            out = br.run_sql(sql, timeout="50s")
            print(f"  ✅ CREATE TABLE: {out['status']}")
        except Exception as e:
            print(f"  ❌ CREATE failed: {e}")
            return 1

        # 2) Row count
        try:
            out = br.run_sql(f"SELECT count(*) AS n FROM {job['table']}")
            n = out["rows"][0][0]
            print(f"  ✅ row count: {n}")
        except Exception as e:
            print(f"  ⚠️  count failed: {e}")
            n = "?"

        # 3) Schema (from DESCRIBE)
        try:
            out = br.run_sql(f"DESCRIBE TABLE {job['table']}")
            print(f"  ✅ schema ({len(out['rows'])} cols):")
            for r in out["rows"][:8]:
                print(f"     - {r[0]}: {r[1]}")
            if len(out["rows"]) > 8:
                print(f"     ... +{len(out['rows']) - 8} more")
        except Exception as e:
            print(f"  ⚠️  DESCRIBE failed: {e}")

    print("\n" + "=" * 60)
    print("  Inventory after ingest")
    print("=" * 60)
    out = br.run_sql(f"SHOW TABLES IN {CATALOG}.{SCHEMA}")
    print(f"\n  tables in {CATALOG}.{SCHEMA}:")
    for r in out["rows"]:
        print(f"    - {r[1]}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
