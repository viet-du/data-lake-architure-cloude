"""Run a SQL statement against Databricks SQL warehouse from local.

Usage:
    python scripts/_sql_query.py "SELECT 1"
    python scripts/_sql_query.py "SHOW SCHEMAS" --catalog workspace
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from pathlib import Path

# Load databricks_bridge.py directly (skip lakehouse.core package init
# which requires optional deps like dotenv / pyspark).
_BR = Path(__file__).parent.parent / "src/lakehouse/core/databricks_bridge.py"
_spec = importlib.util.spec_from_file_location("databricks_bridge", _BR)
_br = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_br)  # type: ignore

is_configured = _br.is_configured
run_sql = _br.run_sql


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("statement", help="SQL to run")
    p.add_argument("--catalog", default=None)
    p.add_argument("--schema", default=None)
    p.add_argument("--warehouse", default=None, help="override warehouse_id")
    p.add_argument("--insecure", action="store_true",
                   help="skip SSL verify (macOS Python 3.14 workaround)")
    p.add_argument("--json", action="store_true", help="raw JSON output")
    args = p.parse_args()

    if args.insecure:
        import os as _os
        _os.environ["LAKEHOUSE_INSECURE"] = "1"

    if not is_configured():
        print("❌ ~/.databrickscfg not configured. Run: python scripts/_quick_config.py")
        return 1

    try:
        out = run_sql(
            args.statement,
            warehouse_id=args.warehouse,
            catalog=args.catalog,
            schema=args.schema,
        )
    except Exception as e:
        print(f"❌ {e}")
        return 2

    if args.json:
        print(json.dumps(out, indent=2, default=str))
        return 0

    cols = out["columns"]
    rows = out["rows"]
    print(f"status={out['status']}  rows={len(rows)}")
    if cols:
        print(" | ".join(cols))
        print("-" * min(80, 8 * len(cols)))
        for r in rows[:50]:
            print(" | ".join(str(x) for x in r))
        if len(rows) > 50:
            print(f"... +{len(rows) - 50} more")
    return 0


if __name__ == "__main__":
    sys.exit(main())
