"""
Configure Databricks Connect without the databricks-connect CLI.

The CLI is broken on Python 3.14 (pyspark < 4 uses removed stdlib `distutils`).
We bypass it by:
  1. Writing ~/.databrickscfg directly
  2. Reading the config with the standard SDK
  3. Using DatabricksSession builder API which imports cleanly

Run:  python scripts/configure_databricks.py
"""
from __future__ import annotations

import configparser
import os
import sys
from pathlib import Path

CFG_PATH = Path.home() / ".databrickscfg"
PROFILE = "DEFAULT_PROFILE"


def write_config(host: str, token: str, cluster_id: str = "", warehouse_id: str = "") -> None:
    cfg = configparser.ConfigParser()
    if CFG_PATH.exists():
        cfg.read(CFG_PATH)
    if PROFILE not in cfg.sections():
        cfg.add_section(PROFILE)
    cfg[PROFILE]["host"] = host
    cfg[PROFILE]["token"] = token
    if cluster_id:
        cfg[PROFILE]["cluster_id"] = cluster_id
    if warehouse_id:
        cfg[PROFILE]["warehouse_id"] = warehouse_id
    with open(CFG_PATH, "w") as f:
        cfg.write(f)
    os.chmod(CFG_PATH, 0o600)
    print(f"✅ wrote {CFG_PATH} (profile={PROFILE})")


def verify_config() -> bool:
    if not CFG_PATH.exists():
        print(f"❌ {CFG_PATH} not found")
        return False
    cfg = configparser.ConfigParser()
    cfg.read(CFG_PATH)
    if PROFILE not in cfg:
        print(f"❌ profile [{PROFILE}] missing")
        return False
    host = cfg[PROFILE].get("host", "")
    token = cfg[PROFILE].get("token", "")
    cluster_id = cfg[PROFILE].get("cluster_id", "")
    warehouse_id = cfg[PROFILE].get("warehouse_id", "")
    print(f"  host:      {host}")
    print(f"  token:     {'*' * 8}...{token[-4:] if token else '(empty)'}")
    print(f"  cluster:   {cluster_id or '(none - use serverless SQL warehouse)'}")
    print(f"  warehouse: {warehouse_id or '(none)'}")
    return bool(host and token)


def main() -> int:
    print("=" * 60)
    print("  Databricks Config Bypass (Python 3.14 compatible)")
    print("=" * 60)

    if "--write" in sys.argv:
        # Non-interactive: read from env or argv
        host = os.getenv("DATABRICKS_HOST", "")
        token = os.getenv("DATABRICKS_TOKEN", "")
        cluster_id = os.getenv("DATABRICKS_CLUSTER_ID", "")
        for i, arg in enumerate(sys.argv):
            if arg == "--host" and i + 1 < len(sys.argv):
                host = sys.argv[i + 1]
            elif arg == "--token" and i + 1 < len(sys.argv):
                token = sys.argv[i + 1]
            elif arg == "--cluster" and i + 1 < len(sys.argv):
                cluster_id = sys.argv[i + 1]
        if not (host and token):
            print("Usage:")
            print("  python scripts/configure_databricks.py --write \\")
            print("      --host https://community.cloud.databricks.com \\")
            print("      --token dapi... \\")
            print("      --cluster 0123-456789-abcdefgh")
            return 1
        write_config(host, token, cluster_id)

    print()
    print("Verifying:")
    if verify_config():
        print("\n✅ ~/.databrickscfg looks good")
        return 0
    else:
        print("\n❌ config invalid")
        return 1


if __name__ == "__main__":
    sys.exit(main())
