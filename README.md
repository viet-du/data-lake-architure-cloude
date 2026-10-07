# 🏔️ Data Lakehouse Architecture — End-to-End Lakehouse on Local & Cloud

> **Lakehouse v3.0** — Dự án Data Lake kiến trúc **Lambda** (Batch + Stream) chạy trên **MinIO + Spark + Kafka + Delta Lake**, kèm **Control Plane** quản trị bằng Next.js (BE) + React/Vite (FE). Hỗ trợ chạy local, Docker, hoặc cloud (GCP/AWS/Azure free tier).

---

## 🎯 Tính năng chính

- ✅ **Medallion Architecture** chuẩn: Bronze → Silver → Gold
- ✅ **Batch ETL/ELT** với PySpark + Delta Lake (ACID, time-travel, schema evolution)
- ✅ **Real-time streaming** với Kafka/Redpanda + Spark Structured Streaming
- ✅ **Mock data generator** (chạy không cần data thật) + **Real crawler** (Tiki, GitHub, Crypto, Weather, HackerNews)
- ✅ **Data Quality checks** với custom rules + profiling
- ✅ **Orchestration** với Apache Airflow 2.7 (3 DAGs sẵn)
- ✅ **BI Dashboard** với Metabase
- ✅ **Control Plane UI** để quản lý pipeline, monitor jobs, browse data
- ✅ **Cloud-ready** — Terraform cho GCP/AWS/Azure
- ✅ **Monorepo** quản lý bằng Nx + pnpm workspaces

---

## 📦 Cấu trúc Monorepo (Nx + pnpm)

Thư mục `apps/` chứa các sub-project, quản lý bằng **Nx + pnpm workspaces**:

```
apps/
├── api/    # Next.js 15 Backend (Control Plane API, ~108 routes)  → port 3001
└── web/    # React 19 + Vite + Tailwind v3 (Control Plane UI)     → port 5173
```

Còn lại là package Python `lakehouse/` chứa toàn bộ batch/stream pipeline.

---

## 🛠 Yêu cầu hệ thống

| Tool | Version tối thiểu | Ghi chú |
|---|---|---|
| **Node.js** | ≥ 20.x | Chạy BE/FE (Next.js + Vite) |
| **pnpm** | ≥ 9.x | Quản lý package (khuyến nghị) |
| **Python** | ≥ 3.10 | Chạy pipeline `lakehouse/` |
| **Docker Desktop** | ≥ 4.x | Chạy MinIO, Spark, Kafka, Airflow, Metabase |
| **MongoDB** | ≥ 6.x | BE lưu catalog |
| **Redis** | ≥ 7.x | BE cache + queue |

> Tip macOS: cài nhanh bằng `brew install node python@3.11 pnpm docker mongodb-community redis`.

---

## ⚙️ Bước 0 — Cài đặt dependencies lần đầu

Chạy 1 lần duy nhất ở **root repo**:

```bash
cd /Users/voanhnhat-ticoder-coder/Documents/data-lake-architure-cloude

# Cài dependencies cho monorepo (apps/api + apps/web)
pnpm install

# Cài Python package (lakehouse) ở chế độ dev
python3 -m pip install -e ".[dev]"

# Copy file env mẫu
cp -n .env.example .env
```

---

## 🚀 Bước 1 — Khởi động Docker stack (MinIO + Spark + Kafka + Airflow + Metabase)

Mở **Docker Desktop** trước, đợi icon chuyển sang **màu xanh ổn định**, rồi chạy:

```bash
cd /Users/voanhnhat-ticoder-coder/Documents/data-lake-architure-cloude

# Cách 1: dùng script có sẵn
bash scripts/start.sh

# Cách 2: Makefile
make up

# Cách 3: docker compose trực tiếp
docker compose -f docker-compose.yml -f docker-compose-kafka.yml up -d
sleep 60   # đợi healthcheck
```

### Kiểm tra các container đã lên

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "lake-"
```

### Bảng URL & Port

| Service | Port | URL | Credentials |
|---|---|---|---|
| **MinIO Console** | 9001 | http://localhost:9001 | `minioadmin` / `minioadmin` |
| **MinIO API** | 9000 | http://localhost:9000 | (dùng nội bộ) |
| **MongoDB** | 27017 | `mongodb://localhost:27017` | (no auth dev) |
| **Redis** | 6379 | `redis://localhost:6379` | (no auth dev) |
| **Redpanda (Kafka)** | 9092 | `localhost:9092` | `PLAINTEXT` |
| **Redpanda Console** | 8081 | http://localhost:8081 | — |
| **Airflow Webserver** | 8088 | http://localhost:8088 | `admin` / `admin` |
| **Spark Master UI** | 8080 | http://localhost:8080 | — |
| **Spark App UI** | 4040 | http://localhost:4040 | — |
| **Metabase** | 3000 | http://localhost:3000 | (tự tạo lúc đầu) |
| **Kafka UI (Redpanda)** | 8081 | http://localhost:8081 | — |

---

## ▶ Bước 2 — Chạy Backend (BE) — Control Plane API

Backend là **Next.js 15** app, cung cấp **~108 REST routes** để quản lý pipeline, browse data, monitor jobs.

**Mở Terminal 1** rồi chạy đúng lệnh sau:

```bash
cd /Users/voanhnhat-ticoder-coder/Documents/data-lake-architure-cloude/apps/api
pnpm run dev
```

### Kết quả mong đợi

Sếp sẽ thấy log kiểu:

```
▲ Next.js 15.x
- Local:        http://127.0.0.1:3001
- Network:      http://<ip-lan>:3001
- Environments: .env.local

✓ Starting...
✓ Ready in ~2s
```

### Verify BE đã lên

```bash
# Health check
curl -s http://127.0.0.1:3001/api/health | python3 -m json.tool

# Mở Swagger docs (nếu có)
open http://127.0.0.1:3001/api/docs
```

### Endpoint chính của BE

| Endpoint | Mô tả |
|---|---|
| `GET  /api/health` | Health check |
| `GET  /api/datasets` | Liệt kê datasets trong Medallion |
| `GET  /api/pipelines` | Liệt kê pipeline + trạng thái |
| `POST /api/pipelines/:id/trigger` | Trigger pipeline |
| `GET  /api/jobs` | Lịch sử job runs |
| `GET  /api/data-quality` | Data quality reports |
| `GET  /api/lineage` | Data lineage graph |
| `GET  /api/catalog/tables` | Catalog tables từ Glue-style |

> **Lưu ý**: Nếu BE báo lỗi `ECONNREFUSED 127.0.0.1:27017` thì MongoDB chưa chạy — chạy `mongod --config /opt/homebrew/etc/mongod.conf --fork` rồi restart BE.

### ENV cần thiết cho BE

BE đọc từ `apps/api/.env.local` hoặc environment. Tối thiểu cần:

```bash
MONGO_URI=mongodb://127.0.0.1:27017/lakehouse_catalog
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
MINIO_ENDPOINT=127.0.0.1:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_SECURE=false
KAFKA_BOOTSTRAP=127.0.0.1:9092
KAFKA_SECURITY_PROTOCOL=PLAINTEXT
AIRFLOW_BASE_URL=http://127.0.0.1:8088/api/v1
AIRFLOW_USERNAME=admin
AIRFLOW_PASSWORD=admin
LOG_LEVEL=info
```

Hoặc chạy nhanh bằng script đã gộp sẵn env:

```bash
bash /Users/voanhnhat-ticoder-coder/Documents/data-lake-architure-cloude/scripts/dev-api.sh
```

---

## ▶ Bước 3 — Chạy Frontend (FE) — Control Plane UI

Frontend là **React 19 + Vite + Tailwind v3**, giao diện quản trị toàn bộ lakehouse.

**Mở Terminal 2** (giữ Terminal 1 chạy BE) rồi chạy đúng lệnh:

```bash
cd /Users/voanhnhat-ticoder-coder/Documents/data-lake-architure-cloude/apps/web
pnpm run dev
```

### Kết quả mong đợi

```
  VITE v5.x  ready in 423 ms

  ➜  Local:   http://127.0.0.1:5173/
  ➜  Network: http://<ip-lan>:5173/
  ➜  press h + enter to show help
```

### Truy cập UI

Mở trình duyệt: **http://127.0.0.1:5173/**

Các trang chính:

| Route | Mô tả |
|---|---|
| `/` | Dashboard tổng quan |
| `/pipelines` | Danh sách + trigger pipeline |
| `/datasets` | Browse Bronze/Silver/Gold tables |
| `/jobs` | Lịch sử job runs |
| `/quality` | Data quality dashboard |
| `/lineage` | Data lineage graph |
| `/crawlers` | Quản lý crawler (Tiki, GitHub, …) |
| `/settings` | Cấu hình connection |

> **Lưu ý**: FE gọi API qua `http://127.0.0.1:3001` — nếu BE chưa chạy thì các trang sẽ hiện lỗi "Network Error" / "Failed to fetch". Đảm bảo Terminal 1 vẫn đang chạy.

### ENV cần thiết cho FE

Tạo file `apps/web/.env.local` (hoặc dùng default trong `vite.config.ts`):

```bash
VITE_API_BASE_URL=http://127.0.0.1:3001
VITE_APP_NAME="Lakehouse Control Plane"
```

---

## ✅ Bước 4 — Verify toàn bộ hệ thống

Sau khi cả BE + FE + Docker stack đã lên, chạy các lệnh verify:

```bash
# 1. Container status
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "lake-"

# 2. API health
curl -s http://127.0.0.1:3001/api/health

# 3. Web load
curl -o /dev/null -w "Web HTTP %{http_code}\n" http://127.0.0.1:5173/

# 4. Mở các dashboard
open http://localhost:3001   # API root
open http://localhost:5173   # Web UI
open http://localhost:9001   # MinIO console
open http://localhost:8088   # Airflow
open http://localhost:8081   # Redpanda Console
open http://localhost:8080   # Spark Master UI
```

Nếu tất cả đều trả về HTTP 200 và không có lỗi `ECONNREFUSED` thì hệ thống đã sẵn sàng.

---

## 🧪 Bước 5 — Chạy thử pipeline (optional, sau khi BE/FE ổn định)

### Batch (Retail)

```bash
cd /Users/voanhnhat-ticoder-coder/Documents/data-lake-architure-cloude
make mock-retail         # Sinh mock data vào data-samples/
make pipeline-batch      # Bronze → Silver → Gold
```

### Streaming (Clickstream)

```bash
make producer-clickstream      # Terminal A: chạy producer
make stream-clickstream        # Terminal B: Spark Streaming job
```

### Streaming (E-commerce + Crawler Tiki)

```bash
make crawl-tiki            # Crawl dữ liệu thật từ Tiki.vn
make stream-ecommerce      # Terminal B: streaming job
```

---

## 🧪 Test & Lint

```bash
make test          # Tất cả test + coverage
make test-fast     # Test không có coverage
make lint          # Ruff lint
make format        # Black + ruff --fix
make typecheck     # Mypy
```

---

## 🛑 Dừng hệ thống

```bash
# Dừng toàn bộ stack (giữ volumes, data còn nguyên)
bash scripts/stop.sh
# hoặc
make down
# hoặc
docker compose -f docker-compose.yml -f docker-compose-kafka.yml down

# Dừng + xóa sạch volumes (reset hoàn toàn)
bash scripts/reset.sh
# hoặc
make clean
# hoặc
docker compose -f docker-compose.yml -f docker-compose-kafka.yml down -v
```

Để dừng riêng BE / FE: bấm `Ctrl + C` ở terminal đang chạy.

---

## 🧰 Stack tổng quan

| Layer | Technology |
|---|---|
| **Storage** | MinIO (S3-compatible) + Delta Lake |
| **Compute (Batch)** | Apache Spark 3.4 + PySpark |
| **Compute (Stream)** | Apache Spark Structured Streaming 3.4 |
| **Messaging** | Apache Kafka / Redpanda |
| **Orchestration** | Apache Airflow 2.7 |
| **BI** | Metabase |
| **Backend (Control Plane)** | Next.js 15 + TypeScript + tRPC |
| **Frontend (Control Plane)** | React 19 + Vite + Tailwind v3 |
| **Catalog DB** | MongoDB 6 |
| **Cache/Queue** | Redis 7 |
| **Language** | Python 3.10+, TypeScript, SQL |

---

## 📂 Cấu trúc chi tiết

```
data-lake-architure-cloude/
├── apps/
│   ├── api/                          # Next.js 15 Backend
│   │   ├── src/
│   │   │   ├── app/                  # App Router
│   │   │   │   └── api/              # 108+ REST routes
│   │   │   ├── components/           # React components (server-side)
│   │   │   ├── lib/                  # Business logic
│   │   │   ├── services/             # Service layer
│   │   │   └── types/                # TypeScript types
│   │   ├── package.json
│   │   └── next.config.ts
│   └── web/                          # React 19 + Vite Frontend
│       ├── src/
│       │   ├── pages/                # React Router pages
│       │   ├── components/           # UI components
│       │   ├── hooks/                # Custom hooks
│       │   ├── api/                  # API client
│       │   └── types/
│       ├── package.json
│       └── vite.config.ts
│
├── src/lakehouse/                    # 🐍 Python package chính
│   ├── core/                        # Spark, paths, env, constants
│   ├── schemas/                     # Centralized schemas
│   ├── ingest/                       # Bronze layer
│   │   ├── batch/                    # CSV/JSON ingestors
│   │   └── streaming/                # Kafka → Bronze
│   ├── transform/                    # Silver layer
│   │   ├── batch/                    # Customers/Products/Orders transformers
│   │   └── streaming/                # Clickstream/Ecommerce transformers
│   ├── aggregate/                    # Gold layer
│   │   ├── batch/                    # Fact + Dim aggregators
│   │   └── streaming/                # Real-time metrics
│   ├── sources/                      # Data sources
│   │   ├── crawlers/                 # Tiki, GitHub, Crypto, Weather, HN
│   │   ├── producers/                # Clickstream producer
│   │   └── mock/                     # Mock data generators
│   ├── quality/                      # Data quality checks
│   ├── pipelines/                    # End-to-end orchestrators
│   └── storage/                      # MinIO + Delta writer
│
├── tests/                            # Unit tests (pytest)
├── airflow_dags/                     # Airflow DAGs (3 DAGs)
├── scripts/                          # Bash utilities
│   ├── start.sh / stop.sh / reset.sh
│   ├── dev-api.sh / dev-web.sh
│   └── .legacy/                      # Old scripts (deprecated)
│
├── docker-compose.yml                # MinIO + Spark + Airflow + Metabase
├── docker-compose-kafka.yml          # Kafka/Redpanda + UI
├── docker-compose-api.yml            # API service trong Docker
├── pyproject.toml                    # Python package config
├── package.json                      # Monorepo root (Nx + pnpm)
├── pnpm-workspace.yaml
├── nx.json
├── Makefile                          # CLI shortcuts
├── .env.example                      # Environment template
│
├── sql/                              # SQL queries
├── data-samples/                     # Mock data
├── configs/                          # Spark/Hive config
├── docs/                             # Documentation
└── terraform/                        # GCP infrastructure
```

---

## 📚 Tài liệu tham khảo

- [`docs/01-architecture-overview.md`](docs/01-architecture-overview.md) — Tổng quan kiến trúc
- [`docs/02-medallion-architecture.md`](docs/02-medallion-architecture.md) — Bronze/Silver/Gold
- [`docs/03-etl-vs-elt.md`](docs/03-etl-vs-elt.md) — ETL vs ELT
- [`docs/04-data-governance.md`](docs/04-data-governance.md) — Data Quality, Security
- [`docs/05-deployment.md`](docs/05-deployment.md) — Cloud deployment
- [`docs/08-kafka-streaming-integration.md`](docs/08-kafka-streaming-integration.md) — Kafka
- [`docs/09-zero-data-pipeline-setup.md`](docs/09-zero-data-pipeline-setup.md) — Setup với mock data
- [`docs/10-real-crawler-guide.md`](docs/10-real-crawler-guide.md) — Crawler dữ liệu thật

---

## 🔄 Data Flow tổng quan

```
┌─────────────────┐
│   Data Sources  │
│  (CSV/JSON/Mock │
│  Kafka/API/Tiki)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│     BRONZE      │ ──▶ │     SILVER      │ ──▶ ┌──────────┐
│ (Raw, append-   │     │ (Cleaned,       │     │   GOLD   │
│  only, schema   │     │  dedup, DQ)     │     │(Aggregated│
│  on read)       │     │                 │     │ business)│
└─────────────────┘     └─────────────────┘     └────┬─────┘
                                                      │
                                                      ▼
                                               ┌──────────────┐
                                               │  Metabase BI │
                                               │  Control UI  │
                                               │  (FE + BE)   │
                                               └──────────────┘
```

---

## 📄 License

MIT License — Free for educational use.
