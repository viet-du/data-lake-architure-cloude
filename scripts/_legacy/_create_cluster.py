"""Create a Databricks cluster using urllib (no SDK needed).

Tested on Python 3.9+.
"""
from __future__ import annotations

import base64
import configparser
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


def read_cfg() -> tuple[str, str]:
    cfg = configparser.ConfigParser()
    cfg.read(Path.home() / ".databrickscfg")
    sect = cfg["DEFAULT_PROFILE"]
    return sect.get("host", ""), sect.get("token", "")


def _make_ssl_context() -> ssl.SSLContext:
    """Build an SSL context, falling back gracefully on macOS Python 3.14
    where the default cert verification fails for some self-signed paths.
    Honours LAKEHOUSE_INSECURE=1 to skip verification entirely.
    """
    if os.environ.get("LAKEHOUSE_INSECURE") == "1":
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx
    try:
        return ssl.create_default_context()
    except Exception:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx


def http(method: str, url: str, token: str, payload: dict | None = None) -> dict:
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "lakehouse-bridge/1.0",
        },
    )
    ctx = _make_ssl_context()
    try:
        with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
            body = resp.read()
            if not body:
                return {}
            return json.loads(body)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        print(f"   HTTP {e.code}: {body}", file=sys.stderr)
        raise
    except urllib.error.URLError as e:
        # Last-resort: retry with cert verification off
        if "CERTIFICATE_VERIFY_FAILED" in str(e) and os.environ.get("LAKEHOUSE_INSECURE") != "1":
            print("   ⚠️  SSL verify failed — retrying with LAKEHOUSE_INSECURE=1")
            os.environ["LAKEHOUSE_INSECURE"] = "1"
            return http(method, url, token, payload)
        raise


def main() -> int:
    host, token = read_cfg()
    if not (host and token):
        print("❌ no host/token in ~/.databrickscfg")
        return 1
    api = host.rstrip("/") + "/api/2.0"
    name = "lakehouse-dev-15lts"

    # 1. List existing
    print("listing existing clusters…")
    lst = http("GET", f"{api}/clusters/list", token)
    for c in lst.get("clusters", []):
        if c.get("cluster_name") == name:
            cid = c["cluster_id"]
            state = c.get("state")
            print(f"✅ exists: {name}  state={state}  id={cid}")
            if state in ("TERMINATED", "TERMINATING"):
                print("   starting…")
                http("POST", f"{api}/clusters/start", token, {"cluster_id": cid})
                return wait_running(host, token, cid)
            if state == "RUNNING":
                print(f"\n>>> CLUSTER_ID={cid}")
                print(f">>> export DATABRICKS_CLUSTER_ID={cid}")
                return 0
            print(f"   state={state} — please investigate")
            return 2

    # 2. Pick runtime & node type
    print("fetching spark versions…")
    try:
        versions = http("GET", f"{api}/clusters/spark-versions", token)
        rt = next(
            (v["key"] for v in versions.get("versions", [])
             if v.get("key", "").startswith("15.4")), None
        )
    except Exception:
        rt = None
    if not rt:
        rt = "15.4.x-scala2.12"
    print(f"   runtime: {rt}")

    print("fetching node types…")
    try:
        nodes = http("GET", f"{api}/clusters/list-node-types", token)
        # Pick the smallest non-deprecated, GPU=false
        candidates = [n for n in nodes.get("node_types", [])
                      if not n.get("deprecated", False)
                      and not n.get("is_graviton", False)
                      and n.get("node_type_id", "").startswith(("m5.", "m4.", "t3."))]
        candidates.sort(key=lambda n: n.get("num_cores", 99))
        node = candidates[0]["node_type_id"] if candidates else "m5.large"
    except Exception:
        node = "m5.large"
    print(f"   node_type: {node}")

    # 3. Create
    print(f"creating cluster '{name}'…")
    payload = {
        "cluster_name": name,
        "spark_version": rt,
        "node_type_id": node,
        "num_workers": 1,
        "autotermination_minutes": 20,
        "data_security_mode": "SINGLE_USER",
    }
    r = http("POST", f"{api}/clusters/create", token, payload)
    cid = r.get("cluster_id")
    if not cid:
        print("❌ create response missing cluster_id:", r)
        return 3
    print(f"   created id={cid}, waiting for RUNNING…")
    return wait_running(host, token, cid)


def wait_running(host: str, token: str, cid: str) -> int:
    api = host.rstrip("/") + "/api/2.0"
    for i in range(60):
        c = http("GET", f"{api}/clusters/get?cluster_id={cid}", token)
        state = c.get("state")
        msg = c.get("state_message", "")
        print(f"   [{i:02d}] {state}  {msg[:60]}")
        if state == "RUNNING":
            print(f"\n>>> CLUSTER_ID={cid}")
            print(f">>> export DATABRICKS_CLUSTER_ID={cid}")
            # save into cfg
            cfg_path = Path.home() / ".databrickscfg"
            cfg = configparser.ConfigParser()
            cfg.read(cfg_path)
            cfg["DEFAULT_PROFILE"]["cluster_id"] = cid
            with open(cfg_path, "w") as f:
                cfg.write(f)
            os.chmod(cfg_path, 0o600)
            print(f">>> saved into {cfg_path}")
            return 0
        if state in ("ERROR", "TERMINATED", "UNKNOWN"):
            print(f"❌ failed: {state}: {msg}")
            return 4
        time.sleep(15)
    print("❌ timeout waiting for RUNNING")
    return 5


if __name__ == "__main__":
    sys.exit(main())
