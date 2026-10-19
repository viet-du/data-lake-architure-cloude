# 📦 Data Lakehouse — Handoff Guide

> **Audience:** Frontend team (Vite + React), backend team, anyone new to the project.
> **Goal:** In 15 minutes, you understand what's deployed, where the data is, and how to consume it.

---

## 🚀 TL;DR — The Project in 30 Seconds

A **data lakehouse** that ingests CSV files, transforms them through **Bronze → Silver → Gold**, and exposes the results through **Databricks Unity Catalog**.

We built it **two ways** (ETL and ELT) to compare paradigms, and the outputs are identical.

| | What | Where it runs |
|---|---|---|
| **Storage** | Databricks Unity Catalog (Delta tables) | Cloud (Databricks workspace) |
| **Compute** | Serverless SQL Warehouse | Databricks Cloud |
| **Code/tools** | Python scripts and local pandas transforms | Mac / local CI |
| **Network** | HTTPS via Databricks SDK and SQL Statement API | Mac → Databricks Cloud |
| **Data** | Delta tables in Unity Catalog | Databricks Cloud |
| **UI** | Databricks Workspace, Catalog and SQL Editor | Databricks-hosted browser UI |

---

## 📁 What's in this repo (read this first)

| File / Folder | What | When to read |
|---|---|---|
| **`README.md`** (root) | Top-level project summary | First thing |
| **`docs/handbook/HANDOFF.md`** | This file — handoff to FE team | First thing |
| **`docs/handbook/DATA_LAYOUT.md`** | Schema of every table | When you query data |
| **`docs/handbook/UI_GUIDE.md`** | How to use Databricks UI | When you browse data |
| **`docs/handbook/TOOLS.md`** | Scripts, env, Docker | When you run the pipeline |
| **`docs/handbook/API.md`** | How frontend consumes the data | When you build a feature |
| **`docs/handbook/ETL_VS_ELT.md`** | Why two pipelines, which to use | When you extend the pipeline |
| **`scripts/run_all.sh`** | One-shot runner | Daily use |

---

## 🗄️ The 10 tables in production

| Layer | Schema | Table | Rows | What it is |
|---|---|---|---|---|
| 🥉 Bronze | `workspace.bronze` | `customers_test` | 10 | Source: CSV in Volume |
| 🥉 Bronze | `workspace.bronze` | `orders_test` | 17 | Source: CSV in Volume |
| 📥 Raw ELT | `workspace.raw_elt` | `customers_raw` | 10 | Verbatim landing (ELT) |
| 📥 Raw ELT | `workspace.raw_elt` | `orders_raw` | 17 | Verbatim landing (ELT) |
| 🥈 Silver | `workspace.silver` | `customers_clean_etl` | 10 | Cleaned + deduped (ETL output) |
| 🥈 Silver | `workspace.silver` | `orders_enriched_etl` | 17 | Joined + enriched (ETL output) |
| 🥈 Silver | `workspace.silver` | `customers_clean_elt` | 10 | Cleaned + deduped (ELT output) |
| 🥈 Silver | `workspace.silver` | `orders_enriched_elt` | 17 | Joined + enriched (ELT output) |
| 🥇 Gold | `workspace.gold` | `customer_ltv_etl` | 10 | Lifetime Value per customer (ETL) |
| 🥇 Gold | `workspace.gold` | `customer_ltv_elt` | 10 | Lifetime Value per customer (ELT) |

**ETL tables** = transformed locally with pandas, written clean.
**ELT tables** = loaded verbatim, transformed with SQL in the warehouse.

Both produce **identical content** — you can query either.

👉 For full schemas, see [`DATA_LAYOUT.md`](./DATA_LAYOUT.md).

---

## ⚡ 1-minute quick start

```bash
# 1. Clone + install
git clone <repo-url>
cd data-lake-architecture
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt      # if exists; else just requests + pandas

# 2. Configure Databricks credentials
cp .env.example .env
$EDITOR .env                         # fill in DATABRICKS_HOST, DATABRICKS_TOKEN, DATABRICKS_WAREHOUSE_ID
python scripts/_quick_config.py      # writes ~/.databrickscfg

# 3. Verify config
python scripts/_sql_query.py "SELECT current_user()"
# → "user@example.com"

# 4. Run the full pipeline (ETL + ELT)
bash scripts/run_all.sh              # ~70s total

# 5. Browse data
# Open: $DATABRICKS_HOST/explore/data/workspace/gold/customer_ltv_etl
```

**The primary pipeline does not require Docker.** The tools run on the Mac, transform or prepare data locally when needed, then call Databricks over HTTPS. Databricks executes warehouse SQL, stores the Delta tables, and exposes them in its own hosted UI. Cloudflare is not the Databricks UI host.

---

## 🎯 For the frontend team

You consume data through **3 channels**:

### Channel 1: Databricks UI (easiest)
- Open `$DATABRICKS_HOST` in browser
- Left sidebar → **Catalog** → `workspace.gold.customer_ltv_etl`
- Click → see data, schema, history, line-age

### Channel 2: SQL Warehouse via Databricks API (programmatic)
Frontend talks to a **backend API** (Next.js / Express). The API calls Databricks SQL Statement Execution API.

```javascript
// Example: backend endpoint that queries the gold table
const result = await fetch(
  `${DATABRICKS_HOST}/api/2.0/sql/statements`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DATABRICKS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      warehouse_id: WAREHOUSE_ID,
      statement: 'SELECT * FROM workspace.gold.customer_ltv_etl ORDER BY lifetime_value DESC',
      catalog: 'workspace',
    }),
  }
);
const { result: { data_array } } = await result.json();
```

👉 Full API reference: [`API.md`](./API.md).

### Channel 3: Direct SQL Editor (for debugging only)
- Open `$DATABRICKS_HOST/sql`
- Pick the warehouse
- Type SQL, see results
- Example: `SELECT * FROM workspace.gold.customer_ltv_etl LIMIT 10`

---

## 🏗️ Architecture (1-paragraph version)

```
CSV files (Volume)
   ↓
[Bronze]    workspace.bronze.*_test       ← raw, 1:1 with CSV
[Raw ELT]   workspace.raw_elt.*_raw       ← verbatim landing (ELT only)
   ↓
[Silver]    workspace.silver.*_clean_*    ← cleaned, deduped, validated
[Silver]    workspace.silver.*_enriched_* ← joined with customers
   ↓
[Gold]      workspace.gold.customer_ltv_* ← LTV per customer (top-level KPI)
```

For full architecture + medallion explanation: [`architecture/ARCHITECTURE.md`](../architecture/ARCHITECTURE.md).

---

## ✅ Definition of Done (current state)

| Task | Status | Evidence |
|---|---|---|
| Bronze layer populated from CSV | ✅ Done | `workspace.bronze.customers_test` = 10 rows |
| Silver layer built (ETL) | ✅ Done | `workspace.silver.customers_clean_etl` = 10 rows |
| Silver layer built (ELT) | ✅ Done | `workspace.silver.customers_clean_elt` = 10 rows |
| Gold layer built (ETL) | ✅ Done | `workspace.gold.customer_ltv_etl` = 10 rows |
| Gold layer built (ELT) | ✅ Done | `workspace.gold.customer_ltv_elt` = 10 rows |
| ETL = ELT (data parity) | ✅ Verified | Row counts match, top-3 LTV match |
| Pipeline runs end-to-end | ✅ Verified | `bash scripts/run_all.sh` exit 0 |
| No secrets in repo | ✅ Clean | `.env` is gitignored, `.env.example` is template only |
| Frontend handoff docs | ✅ This file | You're reading it |

---

## ❓ FAQ

### Q: Should I use the `_etl` or `_elt` tables in the frontend?
**A:** Use either — they have identical data. We keep both so we can compare performance and document the paradigms. If you only need one, pick `_elt` (it's the modern standard for data lakehouse).

### Q: How do I add a new column to the Gold table?
**A:** Edit `scripts/_elt_pipeline.py` (the SQL `CREATE OR REPLACE TABLE` block) and re-run. Do **not** edit Delta tables directly through the UI.

### Q: Can I add a new table without breaking the existing pipeline?
**A:** Yes. Each pipeline (`_etl_pipeline.py`, `_elt_pipeline.py`) is idempotent. Add new steps, run, done. Old tables are not touched.

### Q: Why is `raw_elt` only populated by ELT?
**A:** By design. ELT preserves the raw data for re-processing. ETL discards the raw data after transformation (you have to re-ingest from CSV if you need to redo).

### Q: Where's the Docker / Kafka / MinIO stack?
**A:** The primary ETL/ELT pipeline uses the Mac as a client and Databricks Cloud as the compute/storage/UI platform. The Docker Compose stack is optional for local experiments, Kafka streaming, Airflow, MinIO or API/Web development; it is not the destination for the Databricks tables.

### Q: How do I deploy this to production?
**A:** Not yet. Current setup is dev (Databricks Community / trial). For production: switch to a paid Databricks workspace, move secrets to a vault, add CI/CD to run `run_all.sh` on a schedule.

---

## 🆘 Where to get help

| Question about... | Look at... |
|---|---|
| How to use Databricks UI | [`UI_GUIDE.md`](./UI_GUIDE.md) |
| Table schemas / queries | [`DATA_LAYOUT.md`](./DATA_LAYOUT.md) |
| How to call the data from JS | [`API.md`](./API.md) |
| How the pipeline scripts work | [`TOOLS.md`](./TOOLS.md) |
| Why ETL vs ELT | [`ETL_VS_ELT.md`](./ETL_VS_ELT.md) |
| Architecture / layer design | [`../architecture/ARCHITECTURE.md`](../architecture/ARCHITECTURE.md) |
| Setup R2 / cloud storage | [`../cloud/r2/SETUP.md`](../cloud/r2/SETUP.md) |

---

## 📞 Contact

- Project owner: (check git log)
- Databricks workspace: (set in `.env` → `DATABRICKS_HOST`)
- Issue tracker: (check repo's GitHub Issues tab)
