"""Master: run both paradigms and show side-by-side comparison.

This is the umbrella script. It:
1. Ensures raw_elt schema exists
2. Runs ETL → produces silver/gold tables with _etl suffix
3. Runs ELT → produces raw_elt + silver/gold with _elt suffix
4. Compares row counts and gold layer LTV top-3
5. Recommends a paradigm per use case
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent


def step(name, script):
    print()
    print("─" * 60)
    print(f"  STEP: {name}")
    print("─" * 60)
    res = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / script)],
        cwd=ROOT,
    )
    if res.returncode != 0:
        print(f"❌ {script} failed (exit={res.returncode})")
        sys.exit(res.returncode)


def main() -> int:
    # 1. ensure schemas
    print("▶ Bootstrap: ensure schemas")
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "br", ROOT / "src/lakehouse/core/databricks_bridge.py"
    )
    br = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(br)
    for s in ("bronze", "silver", "gold", "raw_elt"):
        br.run_sql(f"CREATE SCHEMA IF NOT EXISTS workspace.{s}")

    # 2. ETL
    step("ETL paradigm (local transform → clean Delta)", "_etl_pipeline.py")

    # 3. ELT
    step("ELT paradigm (raw landing → SQL transform)", "_elt_pipeline.py")

    # 4. Compare
    step("Side-by-side comparison", "_compare_etl_elt.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
