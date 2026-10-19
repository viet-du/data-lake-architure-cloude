<a id="top"></a>

# Data Lakehouse — Databricks Edition

> **A production-shaped data lakehouse** built on **Databricks Unity Catalog + Delta Lake**, with ETL and ELT pipelines compared side-by-side.

<div align="center">

![Databricks](https://img.shields.io/badge/Databricks-Unity%20Catalog-FF3621?style=for-the-badge&logo=databricks&logoColor=white)
![Delta Lake](https://img.shields.io/badge/Delta%20Lake-ACID-00ADD8?style=for-the-badge)
![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Status](https://img.shields.io/badge/Pipelines-ETL%20%26%20ELT%20verified-brightgreen?style=for-the-badge)

</div>

---

## 🚀 Quick Start (Mac tools → Databricks Cloud)

```bash
# 1. Configure the local client
cp .env.example .env
$EDITOR .env
# Fill DATABRICKS_HOST, DATABRICKS_TOKEN and DATABRICKS_WAREHOUSE_ID.

# 2. Create ~/.databrickscfg from the local .env
set -a; source .env; set +a
python scripts/_quick_config.py

# 3. Verify the HTTPS connection from this Mac to Databricks
python scripts/_sql_query.py "SELECT current_user()"

# 4. Run ETL + ELT from the Mac
bash scripts/run_all.sh

# 5. Open the Databricks workspace UI
open "$DATABRICKS_HOST"
```

The scripts run on this Mac, send SQL and data operations over HTTPS to the
Databricks SQL Warehouse, and write Delta tables into Unity Catalog. The
Databricks workspace UI is hosted by Databricks, not Cloudflare. Cloudflare
Pages may host a separate project Web UI, while Cloudflare R2 is optional
object storage and is not the Databricks UI.

---

## 📁 Project structure

```
data-lake-architecture/
├── scripts/                       ← Pipeline + utility scripts (see scripts/run_all.sh)
│   ├── run_all.sh                 ← ONE-SHOT: ETL + ELT
│   ├── _etl_pipeline.py           ← Transform in pandas → load clean
│   ├── _elt_pipeline.py           ← Load raw → transform in SQL
│   ├── _compare_etl_elt.py        ← Side-by-side report
│   ├── _sql_query.py              ← CLI: arbitrary SQL
│   ├── _quick_config.py           ← Write ~/.databrickscfg
│   └── _legacy/                   ← Old scripts (archived)
│
├── src/lakehouse/                 ← Python package (databricks_bridge.py)
│
├── docs/handbook/                 ← 📖 READ THIS — handoff to frontend team
│   ├── HANDOFF.md                 ← Entry point (15-min read)
│   ├── DATA_LAYOUT.md             ← Schemas + sample queries
│   ├── UI_GUIDE.md                ← Databricks UI walkthrough
│   ├── TOOLS.md                   ← Scripts + env + Docker
│   ├── API.md                     ← Frontend consumes via SQL API
│   └── ETL_VS_ELT.md              ← Why two pipelines
│
├── .env.example                   ← Credential template (NEVER commit .env)
├── docker-compose.yml             ← Optional local Spark/Kafka/Airflow stack
├── docker-compose-kafka.yml       ← Optional local Kafka/Zookeeper overlay
├── docker-compose.dev-api.yml     ← Optional local API/Web overlay
└── README.md                      ← (this file)
```

---

## 🔗 Runtime topology

```text
Local Mac tools/scripts
  ├─ pandas ETL logic
  ├─ Databricks SDK / SQL Statement Execution API
  └─ HTTPS
       ↓
Databricks Cloud
  ├─ SQL Warehouse executes SQL/ELT
  ├─ Unity Catalog manages schemas and tables
  ├─ Delta Lake stores Bronze/Silver/Gold tables
  └─ Databricks Workspace UI shows and queries the data

Optional: Cloudflare Pages hosts a separate project UI.
Optional: Cloudflare R2 stores object data only; it does not host Databricks UI.
```

- **Mac:** runs the client tools and local transformation code.
- **Databricks Cloud:** runs the SQL warehouse, stores Delta tables, and provides the Databricks UI.
- **Cloudflare:** only optional hosting/storage around the system, never the Databricks workspace.

---

## ✍️ Dữ liệu đang được ghi ở đâu?

Pipeline chính chạy từ máy Mac nhưng dữ liệu lakehouse được ghi vào Databricks Cloud:

| Bước | Chạy ở đâu | Đọc từ | Ghi ra |
|---|---|---|---|
| Extract | Mac gọi Databricks SQL Warehouse | CSV trong Databricks Volume `/Volumes/workspace/bronze/bronze_data` | DataFrame tạm trên Mac hoặc raw query trên warehouse |
| ETL transform | Mac, bằng Python/pandas | Dữ liệu đọc từ Volume qua SQL Warehouse | `workspace.silver.customers_clean_etl`, `workspace.silver.orders_enriched_etl`, `workspace.gold.customer_ltv_etl` |
| ELT raw landing | Databricks SQL Warehouse | CSV trong Databricks Volume | `workspace.raw_elt.customers_raw`, `workspace.raw_elt.orders_raw` |
| ELT transform | Databricks SQL Warehouse | `workspace.raw_elt.*` | `workspace.silver.customers_clean_elt`, `workspace.silver.orders_enriched_elt`, `workspace.gold.customer_ltv_elt` |
| Bronze source tables | Databricks Cloud | Dữ liệu nguồn đã nạp sẵn trong Volume | Được pipeline đọc làm đầu vào; không bị ghi đè bởi `run_all.sh` |

### Sau khi chạy `bash scripts/run_all.sh`

Pipeline đọc Bronze CSV từ Databricks Volume, sau đó ghi các bảng Raw ELT, Silver và Gold thành Delta tables trong Unity Catalog của Databricks. DataFrame ETL có thể tồn tại tạm thời trên Mac trong lúc transform, nhưng các bảng kết quả được ghi trên Databricks Cloud, không ghi vào thư mục local trên Mac. Mở Databricks UI rồi vào:

```text
Catalog → workspace → bronze
Catalog → workspace → raw_elt
Catalog → workspace → silver
Catalog → workspace → gold
```

Hoặc mở trực tiếp bảng Gold:

```bash
open "$DATABRICKS_HOST/explore/data/workspace/gold/customer_ltv_etl"
```

Kiểm tra nhanh từ máy Mac:

```bash
python scripts/_sql_query.py "SHOW TABLES IN workspace.gold"
python scripts/_sql_query.py "SELECT * FROM workspace.gold.customer_ltv_etl LIMIT 10"
```

Phân biệt các nơi lưu dữ liệu:

- **Mac:** chỉ chạy scripts, giữ DataFrame tạm và gửi lệnh qua HTTPS.
- **Databricks Cloud:** nơi thực thi SQL, lưu Delta tables và cung cấp Databricks UI.
- **Cloudflare Pages:** chỉ dành cho Web UI riêng nếu có.
- **Cloudflare R2:** storage tùy chọn; không phải Databricks UI và không phải SQL Warehouse.
- **Docker Compose:** stack phụ cho thử nghiệm local, Kafka, Airflow, MinIO, Spark hoặc API/Web; không phải đích ghi của pipeline Databricks.

---

## 🎯 For the frontend team

👉 **Read [`docs/handbook/HANDOFF.md`](./docs/handbook/HANDOFF.md) first.** Everything you need to query data from React/Next.js is there.

TL;DR:
- 10 Delta tables in `workspace.bronze` / `silver` / `gold` / `raw_elt`
- Use either `_etl` or `_elt` tables — same data
- Query via the Next.js API in [`docs/handbook/API.md`](./docs/handbook/API.md)
- Browse data in the Databricks UI ([`UI_GUIDE.md`](./docs/handbook/UI_GUIDE.md))

---

## 🏗️ Architecture

```
CSV files (Volume)
       ↓
[Bronze]   workspace.bronze.*_test         ← raw, 1:1 with CSV
[Raw ELT]  workspace.raw_elt.*_raw          ← verbatim landing (ELT only)
       ↓
[Silver]   workspace.silver.*_clean_*       ← cleaned, deduped, validated
           workspace.silver.*_enriched_*    ← joined with customers
       ↓
[Gold]     workspace.gold.customer_ltv_*    ← LTV per customer (KPI)
```

Both **ETL** (transform in pandas locally) and **ELT** (transform in SQL warehouse) produce identical outputs. Pick `_elt` for new features (warehouse-native, scales better).

---

## 🧪 Current state

| Layer | Schema | Table | Rows | Status |
|---|---|---|---:|---|
| Bronze | workspace.bronze | customers_test | 10 | ✅ |
| Bronze | workspace.bronze | orders_test | 17 | ✅ |
| Raw ELT | workspace.raw_elt | customers_raw | 10 | ✅ |
| Raw ELT | workspace.raw_elt | orders_raw | 17 | ✅ |
| Silver | workspace.silver | customers_clean_etl | 10 | ✅ |
| Silver | workspace.silver | orders_enriched_etl | 17 | ✅ |
| Silver | workspace.silver | customers_clean_elt | 10 | ✅ |
| Silver | workspace.silver | orders_enriched_elt | 17 | ✅ |
| Gold | workspace.gold | customer_ltv_etl | 10 | ✅ |
| Gold | workspace.gold | customer_ltv_elt | 10 | ✅ |

**ETL ≡ ELT**: row counts match, top-3 LTV match. Verified 2026-10-19.

---

## 📜 More docs

- **Handoff for frontend:** [`docs/handbook/HANDOFF.md`](./docs/handbook/HANDOFF.md)
- **Data schemas:** [`docs/handbook/DATA_LAYOUT.md`](./docs/handbook/DATA_LAYOUT.md)
- **Why ETL vs ELT:** [`docs/handbook/ETL_VS_ELT.md`](./docs/handbook/ETL_VS_ELT.md)
- **Setup walkthrough:** [`docs/operations/DATABRICKS_SETUP.md`](./docs/operations/DATABRICKS_SETUP.md)
- **Cloudflare R2 (optional storage only):** [`docs/cloud/r2/SETUP.md`](./docs/cloud/r2/SETUP.md)
- **Local Docker runtime:** [`docs/operations/docker.md`](./docs/operations/docker.md)
- **Architecture details:** [`docs/architecture/ARCHITECTURE.md`](./docs/architecture/ARCHITECTURE.md)

---

## 🔒 Security

- **Never commit `.env`.** Only `.env.example` is tracked.
- **Personal Access Tokens** expire (default 90 days). Rotate regularly.
- **Warehouse is serverless** — scales to zero when idle, no cost for unused time.

---

## 🆘 Help

1. Read [`docs/handbook/HANDOFF.md`](./docs/handbook/HANDOFF.md) (15 min)
2. Check [`docs/handbook/TOOLS.md`](./docs/handbook/TOOLS.md) Troubleshooting section
3. Open an issue with: error message + the script you ran + the SQL (if any)
