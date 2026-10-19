#!/usr/bin/env bash
# =============================================================
# Lakehouse Pipeline — one-shot runner
# =============================================================
# Runs the ETL and ELT pipelines end-to-end and shows a
# side-by-side comparison.
#
# Prerequisite: configure Databricks credentials first
#   cp .env.example .env
#   $EDITOR .env                  # fill in DATABRICKS_HOST, TOKEN, WAREHOUSE_ID
#   python scripts/_quick_config.py
#
# Usage:
#   bash scripts/run_all.sh
# =============================================================

set -euo pipefail
cd "$(dirname "$0")/.."

echo "════════════════════════════════════════════════════════════"
echo "  STEP 1/3: verify Databricks config"
echo "════════════════════════════════════════════════════════════"
if [[ ! -f "$HOME/.databrickscfg" ]]; then
  echo "ERROR: ~/.databrickscfg not found. Run:"
  echo "  python scripts/_quick_config.py"
  exit 1
fi
python3 scripts/_sql_query.py "SELECT 1 AS ok" > /dev/null
echo "  ✅ config valid"

echo
echo "════════════════════════════════════════════════════════════"
echo "  STEP 2/3: ETL (transform local → clean Delta)"
echo "════════════════════════════════════════════════════════════"
python3 scripts/_etl_pipeline.py

echo
echo "════════════════════════════════════════════════════════════"
echo "  STEP 3/3: ELT (raw landing → SQL transform)"
echo "════════════════════════════════════════════════════════════"
python3 scripts/_elt_pipeline.py

echo
echo "════════════════════════════════════════════════════════════"
echo "  ✅ DONE — see results in workspace.gold / silver"
echo "════════════════════════════════════════════════════════════"
echo
echo "  Compare ETL vs ELT outputs:"
echo "    python3 scripts/_compare_etl_elt.py"
echo
echo "  Open Databricks UI:"
echo "    \$DATABRICKS_HOST/explore/data/workspace/gold/customer_ltv_etl"
