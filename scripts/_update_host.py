"""Update host in ~/.databrickscfg from $DATABRICKS_HOST env var.

Preserves the existing token (or sets it from $DATABRICKS_TOKEN if missing).
Run as a normal user (not in sandbox).

Usage:
    export DATABRICKS_HOST="https://dbc-xxxxx.cloud.databricks.com"
    export DATABRICKS_TOKEN="dapi..."   # only needed if profile is empty
    python scripts/_update_host.py
"""
from __future__ import annotations

import configparser
import os
import sys
from pathlib import Path

CFG = Path.home() / ".databrickscfg"
NEW_HOST = os.environ.get("DATABRICKS_HOST")
NEW_TOKEN = os.environ.get("DATABRICKS_TOKEN")

if not NEW_HOST:
    print("ERROR: set DATABRICKS_HOST first, e.g.", file=sys.stderr)
    print('  export DATABRICKS_HOST="https://dbc-xxxxx.cloud.databricks.com"', file=sys.stderr)
    sys.exit(1)

cfg = configparser.ConfigParser()
cfg.read(CFG)
if "DEFAULT_PROFILE" not in cfg:
    cfg.add_section("DEFAULT_PROFILE")
old = cfg["DEFAULT_PROFILE"].get("host", "")
cfg["DEFAULT_PROFILE"]["host"] = NEW_HOST

# Token: prefer env if provided, else keep existing
if NEW_TOKEN:
    cfg["DEFAULT_PROFILE"]["token"] = NEW_TOKEN
elif "token" not in cfg["DEFAULT_PROFILE"]:
    print("ERROR: no token found in profile and $DATABRICKS_TOKEN not set.", file=sys.stderr)
    print("Provide one: export DATABRICKS_TOKEN='dapi...'", file=sys.stderr)
    sys.exit(1)

with open(CFG, "w") as f:
    cfg.write(f)
os.chmod(CFG, 0o600)

print(f"updated {CFG}")
print(f"   old: {old}")
print(f"   new: {NEW_HOST}")
print(f"   token: ***{cfg['DEFAULT_PROFILE']['token'][-6:]}")
