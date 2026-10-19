"""
Local execution helper for Databricks.

Two modes:
1. Interactive (recommended for dev):
       from lakehouse.core.databricks_bridge import remote_spark
       with remote_spark() as spark:
           df = spark.read.format("delta").load("/Volumes/...")
           df.show()

2. Job submission (for batch/CI):
       from lakehouse.core.databricks_bridge import run_notebook
       run_id = run_notebook("/Workspace/Users/.../notebook", params={...})

Setup (one-time, Python 3.14 compatible):
    pip install databricks-sdk
    python scripts/configure_databricks.py --write \\
        --host https://community.cloud.databricks.com \\
        --token <your_token> \\
        --cluster <cluster_id>
"""
from __future__ import annotations

import configparser
import logging
import os
import ssl
import subprocess
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

logger = logging.getLogger(__name__)

_CFG_PATH = Path.home() / ".databrickscfg"
_PROFILE = "DEFAULT_PROFILE"


def _load_config() -> dict[str, str]:
    """Read ~/.databrickscfg into a plain dict."""
    cfg = configparser.ConfigParser()
    if _CFG_PATH.exists():
        cfg.read(_CFG_PATH)
    section = cfg[_PROFILE] if _PROFILE in cfg else {}
    return dict(section)


def is_configured() -> bool:
    """Check if ~/.databrickscfg has host + token."""
    c = _load_config()
    return bool(c.get("host") and c.get("token"))


def is_databricks_connect_available() -> bool:
    """
    Return True if databricks.connect can be imported (no full pyspark needed).
    Returns False on Python 3.14 (no databricks-connect support yet) or if
    the package is missing.
    """
    if sys.version_info >= (3, 14):
        return False
    try:
        import databricks.connect  # noqa: F401
        return True
    except Exception:
        return False


# ── Spark session ────────────────────────────────────────────────
# Try clean import first (no distutils dep), then fall back to
# databricks.connect (requires Python < 3.14 or setuptools shim).
_DATABRICKS_SPARK: Any = None

def _init_spark():
    global _DATABRICKS_SPARK
    if _DATABRICKS_SPARK is not None:
        return _DATABRICKS_SPARK

    cfg = _load_config()
    host = cfg.get("host", "")
    token = cfg.get("token", "")
    cluster_id = cfg.get("cluster_id", "")

    if not (host and token):
        raise RuntimeError(
            f"~/.databrickscfg [{_PROFILE}] missing host/token.\n"
            "Run: python scripts/configure_databricks.py --write ..."
        )

    # ── Attempt 1: databricks.connect (Databricks Connect v2, PySpark-free)
    try:
        from databricks.connect import DatabricksSession as _DS
        builder = _DS.builder
        if host:
            builder = builder.setHost(host)
        if token:
            builder = builder.setToken(token)
        if cluster_id:
            builder = builder.setClusterId(cluster_id)
        _DATABRICKS_SPARK = builder
        logger.info("Using databricks.connect (DatabricksSession)")
        return _DATABRICKS_SPARK
    except (ImportError, Exception) as exc:
        logger.debug("databricks.connect not available: %s", exc)

    # ── Attempt 2: databricks.sdk + spark endpoint
    try:
        from databricks.sdk import DatabricksApiError
        from databricks.sdk.service.spark import SparkAPI
        logger.info("Using databricks.sdk + SparkAPI (REST-only, no PySpark needed)")
        _DATABRICKS_SPARK = "sdk_only"
        return _DATABRICKS_SPARK
    except ImportError:
        pass

    raise RuntimeError(
        "No Databricks client available.\n"
        "Install: pip install databricks-sdk\n"
        "Or (Python < 3.14): pip install databricks-connect"
    )


@contextmanager
def remote_spark(
    app_name: str = "LocalLakehouseClient",
    *,
    cluster_id: str | None = None,
    force_new: bool = False,
) -> Iterator[Any]:
    """
    Context manager that yields a remote SparkSession backed by Databricks cluster.
    All data stays in UC Volumes; local machine only sends code and receives results.
    """
    builder_or_flag = _init_spark()

    if builder_or_flag == "sdk_only":
        raise RuntimeError(
            "databricks-sdk installed but databricks.connect unavailable.\n"
            "For Spark operations from local, install databricks-connect:\n"
            "  pip install databricks-connect\n"
            "Or use run_notebook() / run_python_wheel() for job submission."
        )

    builder = builder_or_flag.appName(app_name)
    if cluster_id:
        builder = builder.setClusterId(cluster_id)

    logger.info("Connecting to Databricks cluster...")
    session = builder.getOrCreate()
    try:
        yield session
    finally:
        try:
            session.stop()
        except Exception:
            pass


# ── Job submission via databricks-cli or databricks-sdk ───────────


def run_notebook(
    notebook_path: str,
    *,
    base_parameters: dict[str, str] | None = None,
    profile: str | None = None,
    timeout_seconds: int = 3600,
) -> dict[str, Any]:
    """
    Submit a Databricks notebook job via REST API (databricks-sdk).
    Works on Python 3.14 (no pyspark needed).
    """
    try:
        from databricks.sdk import WorkspaceClient
        from databricks.sdk.service.jobs import JobsAPI, RunSubmitResult

        cfg = _load_config()
        host = cfg.get("host", "")
        token = cfg.get("token", "")
        if not (host and token):
            raise RuntimeError("No host/token in ~/.databrickscfg")

        # Use SDK directly
        w = WorkspaceClient(host=host, token=token)
        jobs = JobsAPI(w.api_client)

        params = {}
        if base_parameters:
            for k, v in base_parameters.items():
                params[k] = {"type": "value", "value": v}

        import json
        notebook_task = {"notebook_path": notebook_path}
        if params:
            notebook_task["base_parameters"] = params

        run_result = jobs.submit(
            run_name=f"local-submit-{Path(notebook_path).name}",
            tasks=[{"task_key": "main", "notebook_task": notebook_task}],
        )
        run_id = run_result.get("run_id") or run_result.get("run_id")

        logger.info("Job submitted: run_id=%s", run_id)
        return {"run_id": run_id, "status": "SUBMITTED", "sdk": "databricks-sdk"}

    except ImportError:
        # Fallback: use CLI
        profile_arg = ["--profile", profile] if profile else []
        cmd = ["databricks", *profile_arg, "jobs", "submit",
               "--notebook-path", notebook_path]
        if base_parameters:
            for k, v in base_parameters.items():
                cmd += ["--base-parameter", f"{k}={v}"]
        logger.info("Submitting via databricks CLI: %s", notebook_path)
        result = subprocess.run(cmd, capture_output=True, text=True,
                               timeout=timeout_seconds)
        if result.returncode != 0:
            raise RuntimeError(
                f"job submit failed (exit={result.returncode})\n{result.stderr}"
            )
        return {"stdout": result.stdout, "stderr": result.stderr,
                "sdk": "databricks-cli"}


def run_python_wheel(
    job_name: str,
    *,
    parameters: list[str] | None = None,
    profile: str | None = None,
) -> dict[str, Any]:
    """
    Trigger a pre-defined Databricks Job by name.
    Requires the job to be configured once in the UI.
    """
    profile_arg = ["--profile", profile] if profile else []
    list_cmd = ["databricks", *profile_arg, "jobs", "list",
                "--name", job_name, "--output", "json"]
    list_result = subprocess.run(list_cmd, capture_output=True,
                                 text=True, check=True)
    import json
    jobs = json.loads(list_result.stdout or "[]")
    if not jobs:
        raise RuntimeError(f"No Databricks job found with name={job_name!r}")
    job_id = jobs[0]["job_id"]

    run_cmd = ["databricks", *profile_arg, "jobs", "run-now",
               "--job-id", str(job_id)]
    logger.info("Triggering job: %s (id=%s)", job_name, job_id)
    result = subprocess.run(run_cmd, capture_output=True, text=True)
    return {"stdout": result.stdout, "stderr": result.stderr}


# ── Quick smoke test ─────────────────────────────────────────────
def run_sql(
    statement: str,
    *,
    warehouse_id: str | None = None,
    catalog: str | None = None,
    schema: str | None = None,
    timeout: str = "50s",
) -> dict[str, Any]:
    """
    Execute a SQL statement on a Databricks SQL warehouse (REST API).

    Works on Python 3.14 (no pyspark needed). Serverless warehouses
    auto-start, so this is the cheapest way to run queries from local.

    Returns: dict with keys: status, columns, rows
    """
    import base64
    import json as _json
    import ssl
    import urllib.error
    import urllib.request

    cfg = _load_config()
    host = cfg.get("host", "").rstrip("/")
    token = cfg.get("token", "")
    wh = warehouse_id or cfg.get("warehouse_id", "")
    if not (host and token and wh):
        raise RuntimeError(
            f"~/.databrickscfg needs host, token, and warehouse_id (got host={bool(host)}, "
            f"token={bool(token)}, warehouse_id={bool(wh)})\n"
            f"Run: python scripts/_quick_config.py"
        )

    payload: dict[str, Any] = {
        "warehouse_id": wh,
        "statement": statement,
        "wait_timeout": timeout,
    }
    if catalog:
        payload["catalog"] = catalog
    if schema:
        payload["schema"] = schema

    req = urllib.request.Request(
        f"{host}/api/2.0/sql/statements/",
        data=_json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    ctx = ssl.create_default_context()
    if os.environ.get("LAKEHOUSE_INSECURE") == "1":
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    try:
        with urllib.request.urlopen(req, timeout=120, context=ctx) as resp:
            result = _json.loads(resp.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"SQL error {e.code}: {e.read().decode()}") from e
    except urllib.error.URLError as e:
        # macOS Python 3.14 often fails SSL verify for system CA bundle
        if "CERTIFICATE_VERIFY_FAILED" in str(e):
            ctx2 = ssl.create_default_context()
            ctx2.check_hostname = False
            ctx2.verify_mode = ssl.CERT_NONE
            with urllib.request.urlopen(req, timeout=120, context=ctx2) as resp2:
                result = _json.loads(resp2.read())
        else:
            raise

    state = result.get("status", {}).get("state", "UNKNOWN")
    if state not in ("SUCCEEDED",):
        raise RuntimeError(f"SQL {state}: {result.get('status', {}).get('error', {})}")

    cols = [c["name"] for c in result.get("manifest", {}).get("schema", {}).get("columns", [])]
    rows = result.get("result", {}).get("data_array", [])
    return {"status": state, "columns": cols, "rows": rows, "raw": result}


def smoke_test() -> None:
    """
    Verify the bridge is working.

    Run from local terminal:
        python -c "from lakehouse.core.databricks_bridge import smoke_test; smoke_test()"
    """
    print("=" * 60)
    print("  Databricks Bridge — Smoke Test")
    print("=" * 60)
    print(f"  ~/.databrickscfg exists:   {is_configured()}")
    if not is_configured():
        print("\n  → python scripts/_quick_config.py")
        return

    # Test 1: SQL warehouse
    try:
        out = run_sql("SELECT 'ok' AS status, current_user() AS user, current_database() AS db")
        if out["rows"]:
            row = out["rows"][0]
            print(f"  ✅ SQL warehouse works:")
            print(f"     status={row[0]}  user={row[1]}  db={row[2]}")
        else:
            print(f"  ⚠️  SQL returned no rows: {out}")
    except Exception as e:
        print(f"  ⚠️  SQL smoke test failed: {e}")
        print("  → check host/token/warehouse_id in ~/.databrickscfg")

    # Test 2: catalog/unity
    try:
        out = run_sql("SHOW CATALOGS")
        cats = [r[0] for r in out["rows"]]
        print(f"  ✅ catalogs visible: {cats}")
    except Exception as e:
        print(f"  ⚠️  SHOW CATALOGS failed: {e}")

