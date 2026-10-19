"""Quick config writer — reads secrets from env, writes to ~/.databrickscfg.

Reads DATABRICKS_HOST and DATABRICKS_TOKEN from environment.
Writes them to the Databricks CLI profile (~/.databrickscfg).

Setup:
    export DATABRICKS_HOST="https://dbc-xxxxx.cloud.databricks.com"
    export DATABRICKS_TOKEN="dapi..."
    export DATABRICKS_WAREHOUSE_ID="affdbeeaeabd36ae"
    python scripts/_quick_config.py

Cluster ID is optional (only needed for run_pipeline_remote.py / cluster jobs).
"""
from __future__ import annotations

import importlib.util
import os
import sys
from pathlib import Path

# Load configure_databricks.py by file path (no package init needed)
_SCRIPT = Path(__file__).parent / "configure_databricks.py"
_spec = importlib.util.spec_from_file_location("configure_databricks", _SCRIPT)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)  # type: ignore

write_config = _mod.write_config
verify_config = _mod.verify_config
write_config.__module__ = "scripts.configure_databricks"

# Required
HOST = os.environ.get("DATABRICKS_HOST")
TOKEN = os.environ.get("DATABRICKS_TOKEN")

# Optional
CLUSTER = os.environ.get("DATABRICKS_CLUSTER_ID", "")
WAREHOUSE = os.environ.get("DATABRICKS_WAREHOUSE_ID", "")

if not HOST or not TOKEN:
    print("ERROR: DATABRICKS_HOST and DATABRICKS_TOKEN must be set.", file=sys.stderr)
    print("", file=sys.stderr)
    print("Example:", file=sys.stderr)
    print('  export DATABRICKS_HOST="https://dbc-xxxxx.cloud.databricks.com"', file=sys.stderr)
    print('  export DATABRICKS_TOKEN="dapi..."', file=sys.stderr)
    sys.exit(1)

write_config(HOST, TOKEN, CLUSTER, warehouse_id=WAREHOUSE)
print()
verify_config()
print()
print("workspace ready")
print(f"   host:      {HOST}")
print(f"   warehouse: {WAREHOUSE or '(not set)'} (Serverless Starter)")
print(f"   cluster:   {'set' if CLUSTER else 'not set (using serverless SQL warehouse only)'}")
print()
print("Try a smoke test:")
print('   python scripts/_sql_query.py "SELECT current_user(), current_database()"')
