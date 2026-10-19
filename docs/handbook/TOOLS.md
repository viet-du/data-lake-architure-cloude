# 🛠️ Tools & Scripts Reference

> **Mục đích:** Mọi thứ về scripts trong `scripts/`: cách chạy, env setup, Docker build, troubleshooting.

---

## 📁 scripts/ folder layout

```
scripts/
├── run_all.sh              ← ONE-SHOT: ETL + ELT + verify
│
├── _etl_pipeline.py        ← ETL: extract → pandas transform → load clean
├── _elt_pipeline.py        ← ELT: extract → load raw → SQL transform
├── _compare_etl_elt.py     ← Side-by-side comparison
├── _run_both.py            ← Programmatic runner (used by _compare_etl_elt.py)
│
├── _sql_query.py           ← CLI: run arbitrary SQL against warehouse
├── _quick_config.py        ← Bootstrap: write ~/.databrickscfg from env
├── _update_host.py         ← Edit just the host in existing config
├── configure_databricks.py ← Config bypass (CLI args)
│
├── verify_r2.py            ← (legacy) test R2 connection
│
├── _legacy/                ← old scripts, archived, not used
│   ├── _ingest_test.py
│   ├── _silver_gold_test.py
│   ├── _create_cluster.py
│   └── run_pipeline_remote.py
│
└── README.md               ← (this is in docs/handbook/TOOLS.md)
```

### Naming convention

| Prefix | What |
|---|---|
| `_xxx.py` (leading underscore) | Internal helper, not meant to be called directly by users |
| `xxx.sh` | User-facing entry point |
| `verify_*.py` | Sanity / health check |

---

## ⚡ Entry points (the 4 you'll actually use)

### 1. `bash scripts/run_all.sh` — One-shot

Runs ETL → ELT end-to-end, takes ~70s.

```bash
$ bash scripts/run_all.sh

════════════════════════════════════════════════════════════
  STEP 1/3: verify Databricks config
════════════════════════════════════════════════════════════
  ✅ config valid

════════════════════════════════════════════════════════════
  STEP 2/3: ETL (transform local → clean Delta)
════════════════════════════════════════════════════════════
============================================================
  ETL: Transform on local → Load clean Delta
============================================================
[1/4] EXTRACT: read CSVs from Volume via warehouse
  customers: 10 rows, 6 cols
  orders:    17 rows, 6 cols
  ⏱  13.32s
[2/4] TRANSFORM (local pandas): dedup, validate, enrich
  customers_clean: 10 rows after dedup+validate
  orders_enriched: 17 rows after join+enrich
  customer_ltv: 10 rows aggregated
  ⏱  0.0462s (local CPU)
[3/4] LOAD: write clean Delta tables (one row at a time via VALUES)
  ✅ workspace.silver.customers_clean_etl
  ✅ workspace.silver.orders_enriched_etl
  ✅ workspace.gold.customer_ltv_etl
  ⏱  15.37s
[4/4] VERIFY: read back from Delta
  ✅ silver.customers_clean_etl = 10 rows
  ✅ silver.orders_enriched_etl = 17 rows
  ✅ gold.customer_ltv_etl = 10 rows
  ⏱  6.89s
============================================================
  ETL Pipeline Summary
============================================================
  extract                13.317s
  transform_local         0.046s
  load_clean             15.368s
  verify                  6.886s
  total                  35.617s

[similar for ELT...]
```

### 2. `python scripts/_etl_pipeline.py` — ETL only

```bash
python scripts/_etl_pipeline.py
```

See [`ETL_VS_ELT.md`](./ETL_VS_ELT.md) for what ETL does.

### 3. `python scripts/_elt_pipeline.py` — ELT only

```bash
python scripts/_elt_pipeline.py
```

### 4. `python scripts/_sql_query.py "SQL..."` — arbitrary SQL

```bash
# Simple
python scripts/_sql_query.py "SELECT 1"

# With explicit catalog
python scripts/_sql_query.py "SHOW SCHEMAS" --catalog workspace

# JSON output (for piping)
python scripts/_sql_query.py "SELECT * FROM workspace.gold.customer_ltv_etl" --json

# Skip SSL (macOS Python 3.14 workaround)
python scripts/_sql_query.py "SELECT 1" --insecure
```

### 5. `python scripts/_compare_etl_elt.py` — comparison report

Runs both pipelines, shows timings + side-by-side LTV top-3.

```bash
$ python scripts/_compare_etl_elt.py
...
⏱  ETL total: 35.6s
⏱  ELT total: 37.2s

When to use each paradigm:
  ETL → small data, complex Python lib
  ELT → large data, SQL-friendly, schema evolution
```

---

## 🔐 Environment setup

### Step 1: Get credentials

You need:
- **DATABRICKS_HOST** — workspace URL (e.g. `https://dbc-xxxxx.cloud.databricks.com`)
- **DATABRICKS_TOKEN** — Personal Access Token (PAT) from Databricks UI
- **DATABRICKS_WAREHOUSE_ID** — SQL Warehouse ID

**Where to get the token:**

1. Open `$DATABRICKS_HOST` in browser
2. Click avatar (top-right) → **User Settings**
3. Tab **Developer** → **Access Tokens**
4. **Generate new token** → copy

**Where to get warehouse ID:**

1. Sidebar → **SQL Editor**
2. Top-right dropdown "Warehouse" → click ⚙️ icon
3. URL bar shows: `/sql/warehouses/affdbeeaeabd36ae`
4. ID = `affdbeeaeabd36ae`

### Step 2: Create .env

```bash
cp .env.example .env
$EDITOR .env
```

Fill in:
```bash
DATABRICKS_HOST="https://dbc-70e4e968-2b60.cloud.databricks.com"
DATABRICKS_TOKEN="<REDACTED_DATABRICKS_TOKEN>"
DATABRICKS_WAREHOUSE_ID="affdbeeaeabd36ae"
DATABRICKS_CLUSTER_ID=""           # not needed for current pipeline
```

> ⚠️ **NEVER commit `.env`.** It's in `.gitignore`. Only `.env.example` is tracked.

### Step 3: Write Databricks config

```bash
# Auto: reads from .env
source .env && python scripts/_quick_config.py

# Manual: pass env vars
export DATABRICKS_HOST=...
export DATABRICKS_TOKEN=...
python scripts/_quick_config.py
```

This writes `~/.databrickscfg` (mode 0600 = owner-only read).

### Step 4: Verify

```bash
python scripts/_sql_query.py "SELECT current_user() AS me, current_database() AS db"
# status=SUCCEEDED  rows=1
# me | db
# ----
# your@email.com | workspace
```

---

## 🐍 Python deps

The pipeline scripts use only stdlib + these 3 packages:

```bash
pip install requests pandas
```

| Package | Why | Used by |
|---|---|---|
| `requests` | HTTPS to Databricks REST API | All scripts |
| `pandas` | DataFrame ops in ETL | `_etl_pipeline.py` |
| (stdlib) `importlib`, `configparser`, `subprocess`, `argparse` | Loading bridge module, CLI | All scripts |

There's no `requirements.txt` because deps are minimal. If you need to freeze:

```bash
pip freeze > requirements.txt
```

---

## 🐳 Docker

> **Current state:** The pipeline does **not** use Docker. It runs from your laptop.
> The legacy docker-compose stack (MinIO, Spark, Airflow, Kafka) still exists but is **not used** by the Databricks-based pipeline.

### Legacy stack (if you need it)

```bash
# From project root
make up
sleep 60
make verify
```

See [`../operations/DEV_LINKS.md`](../operations/DEV_LINKS.md) for full URL list.

### Build pipeline as a Docker image (TODO)

For this project, run the pipeline locally with Docker Compose:

```dockerfile
# Dockerfile.pipeline
FROM python:3.12-slim
WORKDIR /app
COPY scripts/ ./scripts/
RUN pip install --no-cache-dir requests pandas
ENV DATABRICKS_HOST=""
ENV DATABRICKS_TOKEN=""
ENV DATABRICKS_WAREHOUSE_ID=""
ENTRYPOINT ["bash", "scripts/run_all.sh"]
```

```bash
docker build -f Dockerfile.pipeline -t lakehouse-pipeline:latest .
docker run --env-file .env lakehouse-pipeline:latest
```

> **Status:** Not yet done. To be implemented when productionizing.

---

## 🐚 Shell environment

### Loading .env into current shell

```bash
# Option 1: source
set -a; source .env; set +a

# Option 2: direnv (auto-load on cd)
brew install direnv
echo 'eval "$(direnv hook zsh)"' >> ~/.zshrc
echo 'dotenv' > .envrc
direnv allow

# Option 3: python-dotenv (load inside Python)
pip install python-dotenv
python -c "from dotenv import load_dotenv; load_dotenv(); import os; print(os.environ['DATABRICKS_HOST'])"
```

### Verify config

```bash
echo "Host:      $DATABRICKS_HOST"
echo "Warehouse: $DATABRICKS_WAREHOUSE_ID"
echo "Token:     ${DATABRICKS_TOKEN:0:8}..."
```

---

## 🧪 Testing

There is no formal pytest suite yet. To verify after a change:

```bash
# 1. End-to-end
bash scripts/run_all.sh
echo "Exit: $?"  # must be 0

# 2. Spot checks
python scripts/_sql_query.py "
  SELECT
    (SELECT COUNT(*) FROM workspace.gold.customer_ltv_etl) AS etl,
    (SELECT COUNT(*) FROM workspace.gold.customer_ltv_elt) AS elt
"
# Should show etl=10, elt=10

# 3. Parity check (advanced)
python scripts/_compare_etl_elt.py
```

---

## 🔄 Adding a new pipeline step

Say you want to add a "daily_revenue" Gold table.

**Step 1:** Edit `scripts/_etl_pipeline.py` — add after LTV aggregation:

```python
# Silver→Gold: daily_revenue
daily_rev = orders_enriched[orders_enriched["status"] == "completed"] \
    .groupby("order_date", as_index=False) \
    .agg(daily_revenue=("line_total", "sum"),
         order_count=("order_id", "nunique"))
_write_df_to_delta(daily_rev, f"{GOLD}.daily_revenue_etl")
```

**Step 2:** Edit `scripts/_elt_pipeline.py` — add SQL block:

```sql
CREATE OR REPLACE TABLE workspace.gold.daily_revenue_elt AS
SELECT
  order_date,
  SUM(line_total) AS daily_revenue,
  COUNT(DISTINCT order_id) AS order_count
FROM workspace.silver.orders_enriched_elt
WHERE status = 'completed'
GROUP BY order_date
ORDER BY order_date;
```

**Step 3:** Run:

```bash
bash scripts/run_all.sh
```

**Step 4:** Update [`DATA_LAYOUT.md`](./DATA_LAYOUT.md) to document the new table.

---

## ❓ Troubleshooting

### `❌ ~/.databrickscfg not configured`

→ Run `python scripts/_quick_config.py` after setting env vars.

### `❌ {'error_code': 'PERMISSION_DENIED'}`

→ Token is invalid or expired. Generate a new one in Databricks UI.

### `❌ {'error_code': 'BAD_REQUEST', 'message': '... warehouse ...' }`

→ Warehouse ID is wrong, OR warehouse is stopped. Check warehouse status in UI.

### `❌ SQL FAILED: ... line_total >= 1000 ...`

→ `line_total` is `DECIMAL` in ETL, `DOUBLE` in ELT. CAST in your query.

### `Read timed out` / connection refused

→ Databricks is down OR your network blocks HTTPS to `*.cloud.databricks.com`. Check `curl -I $DATABRICKS_HOST`.

### `ModuleNotFoundError: No module named 'databricks'`

→ Run from repo root: `cd /path/to/data-lake-architecture && python scripts/...`. Don't move scripts elsewhere.

### Pipeline hangs at "EXTRACT"

→ SQL warehouse is starting (cold start ~30s on first query of the day). Subsequent queries fast.

---

## 📜 Maintenance checklist

| When | Task |
|---|---|
| **Every commit** | Run `bash scripts/run_all.sh` — make sure exit 0 |
| **Adding new table** | Update DATA_LAYOUT.md + run pipeline + verify |
| **Rotating token** | Update `.env`, re-run `_quick_config.py` |
| **New team member** | Share this file + HANDOFF.md + .env (via 1Password / Vault, NOT git) |
| **Schema change** | Re-run `DESCRIBE TABLE` queries from DATA_LAYOUT.md, update doc |
| **Cost spike** | Check Databricks workspace → **Usage** tab → see which queries are expensive |
