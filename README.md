

# DATA LAKEHOUSE ARCHITECTURE — END-TO-END LOCAL & CLOUD PLATFORM

> **Lakehouse v3.0 · Lambda Architecture · Medallion Architecture · Batch + Streaming · Control Plane**
>
> Technical documentation for installing, running, validating, operating, and extending a Data Lakehouse built on **MinIO + Apache Spark + Kafka/Redpanda + Delta Lake**, with a **Next.js Control Plane API** and **React/Vite Control Plane UI**. The platform supports local development, Docker-based execution, and cloud-oriented deployment workflows for **GCP / AWS / Azure**.



MinIO
Apache Spark
Kafka
Delta Lake
Airflow

Next.js
React
Python
Docker






| **3** Medallion Layers        | **~108** Control Plane API Routes | **3** Airflow DAGs       | **3** Cloud Targets      |
| ----------------------------- | --------------------------------- | ------------------------ | ------------------------ |
| **Batch + Stream** Processing | **5** Real Crawler Sources        | **2** Control Plane Apps | **1** Nx + pnpm Monorepo |




---



## 🧭 MỤC LỤC (TABLE OF CONTENTS)


| #                                       | Mục                             | Nội dung chính                                           |
| --------------------------------------- | ------------------------------- | -------------------------------------------------------- |
| [01](#01-tong-quan)                     | **Tổng quan**                   | Platform purpose · Execution model · Core features       |
| [02](#02-kien-truc-va-data-flow)        | **Kiến trúc & Data Flow**       | Lambda · Medallion · Batch/Stream · Consumption          |
| [03](#03-monorepo-va-project-layout)    | **Monorepo & Project Layout**   | Nx · pnpm · API · Web · Python package                   |
| [04](#04-yeu-cau-he-thong)              | **Yêu cầu hệ thống**            | Runtime · Infrastructure · Preflight                     |
| [05](#05-cai-dat-lan-dau)               | **Cài đặt lần đầu**             | Dependencies · Python editable install · `.env`          |
| [06](#06-docker-infrastructure-stack)   | **Docker Infrastructure**       | MinIO · Spark · Redpanda · Airflow · Metabase · DB/Cache |
| [07](#07-backend-control-plane-api)     | **Backend — Control Plane API** | Next.js 15 · ENV · REST routes · Health check            |
| [08](#08-frontend-control-plane-ui)     | **Frontend — Control Plane UI** | React 19 · Vite · Routes · API integration               |
| [09](#09-end-to-end-verification)       | **End-to-End Verification**     | Containers · API · Web · Service readiness               |
| [10](#10-pipeline-execution)            | **Pipeline Execution**          | Batch · Clickstream · E-commerce crawler                 |
| [11](#11-test-lint-va-quality-gates)    | **Test, Lint & Quality Gates**  | pytest · Ruff · Black · Mypy                             |
| [12](#12-dung-reset-va-cleanup)         | **Dừng, Reset & Cleanup**       | Graceful stop · Volumes · Full reset                     |
| [13](#13-technology-stack)              | **Technology Stack**            | Storage · Compute · Messaging · Control Plane            |
| [14](#14-cau-truc-thu-muc-chi-tiet)     | **Cấu trúc thư mục chi tiết**   | Repository tree · Responsibilities                       |
| [15](#15-tai-lieu-tham-khao-va-license) | **References & License**        | Internal docs · MIT License                              |


---



## 01. TỔNG QUAN (OVERVIEW)

**Lakehouse v3.0** là một Data Lakehouse triển khai theo **Lambda Architecture**, kết hợp **Batch Processing** và **Stream Processing** trên cùng một nền tảng dữ liệu. Hệ thống sử dụng **Medallion Architecture** để tổ chức dữ liệu theo ba lớp **Bronze → Silver → Gold**, đồng thời cung cấp một **Control Plane** để quản lý pipeline, quan sát job và duyệt dữ liệu.

### 1.1 Platform at a Glance


| Thành phần                        | Vai trò                                                     |
| --------------------------------- | ----------------------------------------------------------- |
| **MinIO + Delta Lake**            | Storage layer, S3-compatible object storage và Delta tables |
| **Apache Spark / PySpark**        | Batch ETL/ELT và distributed data processing                |
| **Spark Structured Streaming**    | Real-time / near-real-time stream processing                |
| **Kafka / Redpanda**              | Event streaming và message transport                        |
| **Apache Airflow 2.7**            | Workflow orchestration với 3 DAGs có sẵn                    |
| **Metabase**                      | BI dashboard / analytics consumption                        |
| **Next.js 15**                    | Backend Control Plane API                                   |
| **React 19 + Vite + Tailwind v3** | Frontend Control Plane UI                                   |
| **MongoDB 6**                     | Catalog database cho backend                                |
| **Redis 7**                       | Cache + queue                                               |
| **Terraform**                     | Cloud-oriented infrastructure cho GCP / AWS / Azure         |




### 1.2 Tính năng chính (Core Capabilities)

- ✅ **Medallion Architecture**: Bronze → Silver → Gold.
- ✅ **Batch ETL/ELT** bằng PySpark + Delta Lake với ACID, time-travel và schema evolution.
- ✅ **Real-time streaming** bằng Kafka/Redpanda + Spark Structured Streaming.
- ✅ **Mock data generator** để chạy khi chưa có dữ liệu thật.
- ✅ **Real crawlers** cho Tiki, GitHub, Crypto, Weather và HackerNews.
- ✅ **Data Quality** bằng custom rules + profiling.
- ✅ **Orchestration** bằng Apache Airflow 2.7 với 3 DAGs có sẵn.
- ✅ **BI Dashboard** bằng Metabase.
- ✅ **Control Plane UI** để quản lý pipeline, monitor jobs và browse data.
- ✅ **Cloud-ready** với Terraform cho GCP / AWS / Azure.
- ✅ **Monorepo** quản lý bằng Nx + pnpm workspaces.



### 1.3 Operational Lifecycle


| **SETUP** Dependencies      | →   | **INFRA** Docker Stack | →   | **API** Control Plane BE | →   | **WEB** Control Plane FE |
| --------------------------- | --- | ---------------------- | --- | ------------------------ | --- | ------------------------ |
|                             |     |                        |     |                          |     | ↓                        |
| **PIPELINE** Batch / Stream | ←   | **VERIFY** End-to-End  | ←   | **QUALITY** Test / Lint  | ←   | **READY** Platform       |


> [!IMPORTANT]
> Tài liệu này mô tả **developer-oriented local execution flow** trước, sau đó mới chạy pipeline và các workload dữ liệu. Trình tự khuyến nghị là: **dependencies → infrastructure → backend → frontend → verification → pipeline**.

---



## 02. KIẾN TRÚC & DATA FLOW (ARCHITECTURE & DATA FLOW)



### 2.1 Lambda + Medallion Model

Hệ thống kết hợp hai hướng xử lý:

- **Batch path**: đọc dữ liệu batch / mock / crawler → xử lý bằng Spark/PySpark → ghi vào Delta Lake.
- **Streaming path**: nhận event từ Kafka/Redpanda → Spark Structured Streaming → cập nhật dữ liệu theo luồng.

Cả hai hướng hội tụ vào **Medallion Architecture**:

```text
DATA SOURCES
CSV / JSON / Mock / API / Tiki / GitHub / Crypto / Weather / HackerNews
        │
        ├──────────────────── BATCH ────────────────────┐
        │                                               │
        │        Spark / PySpark ETL / ELT              │
        │                                               ▼
        │                                         ┌──────────┐
        │                                         │  BRONZE  │
        │                                         │   Raw    │
        │                                         └────┬─────┘
        │                                              │
        └─ Kafka / Redpanda ─ Spark Streaming ─────────┘
                                                       │
                                                       ▼
                                                ┌──────────┐
                                                │  SILVER  │
                                                │ Cleaned  │
                                                │ Dedup/DQ │
                                                └────┬─────┘
                                                     │
                                                     ▼
                                                ┌──────────┐
                                                │   GOLD   │
                                                │ Business │
                                                │Aggregate │
                                                └────┬─────┘
                                                     │
                              ┌──────────────────────┴──────────────────────┐
                              ▼                                             ▼
                       ┌──────────────┐                              ┌──────────────┐
                       │ Metabase BI  │                              │ Control Plane│
                       │ Analytics    │                              │ API + Web UI │
                       └──────────────┘                              └──────────────┘
```



### 2.2 Medallion Responsibilities


| Layer      | Vai trò                   | Nội dung theo project                                        |
| ---------- | ------------------------- | ------------------------------------------------------------ |
| **Bronze** | Raw ingestion             | CSV/JSON ingestors, Kafka → Bronze, append-oriented raw data |
| **Silver** | Cleaning / Transformation | Customers, Products, Orders, streaming transforms, dedup, DQ |
| **Gold**   | Business Aggregation      | Fact/Dim aggregators và real-time metrics                    |




### 2.3 Control Plane

Control Plane được chia thành hai application:

```text
┌─────────────────────────────┐      HTTP / API      ┌─────────────────────────────┐
│ apps/web                    │ ───────────────────▶ │ apps/api                    │
│ React 19 + Vite             │                      │ Next.js 15                  │
│ Tailwind v3                 │ ◀─────────────────── │ Control Plane API           │
│ Port 5173                   │                      │ Port 3001                   │
└─────────────────────────────┘                      └──────────────┬──────────────┘
                                                                  │
                         ┌────────────────────────────────────────┼─────────────────────────┐
                         ▼                                        ▼                         ▼
                    MongoDB 6                                 Redis 7              MinIO / Kafka / Airflow
                    Catalog DB                              Cache / Queue             Platform Services
```

---



## 03. MONOREPO & PROJECT LAYOUT

Repository được tổ chức theo **Nx + pnpm workspaces** cho phần JavaScript/TypeScript, kết hợp Python package trong `src/lakehouse/` cho data pipeline.

### 3.1 Control Plane Apps

```text
apps/
├── api/    # Next.js 15 Backend — Control Plane API (~108 routes) → port 3001
└── web/    # React 19 + Vite + Tailwind v3 — Control Plane UI     → port 5173
```



### 3.2 Data Platform Package

```text
src/lakehouse/
├── core/
├── schemas/
├── ingest/
├── transform/
├── aggregate/
├── sources/
├── quality/
├── pipelines/
└── storage/
```



### 3.3 Source-of-Responsibility Mapping


| Khu vực          | Trách nhiệm chính                                            |
| ---------------- | ------------------------------------------------------------ |
| `apps/api/`      | Control Plane API, business logic, service integration       |
| `apps/web/`      | Dashboard và operational UI                                  |
| `src/lakehouse/` | Batch/stream ingestion, transformation, aggregation, storage |
| `airflow_dags/`  | Orchestration workflows                                      |
| `tests/`         | Python unit tests                                            |
| `scripts/`       | Start/stop/reset/dev utilities                               |
| `configs/`       | Spark/Hive configuration                                     |
| `terraform/`     | Cloud infrastructure                                         |
| `docs/`          | Architecture và operation documentation                      |


> [!NOTE]
> Trong repository hiện tại, Python package chính nằm tại `src/lakehouse/`. Các lệnh cài package ở root sử dụng `pyproject.toml` để expose package này ở chế độ development.

---



## 04. YÊU CẦU HỆ THỐNG (SYSTEM REQUIREMENTS)



### 4.1 Runtime & Infrastructure Requirements


| Tool               | Version tối thiểu | Vai trò                               |
| ------------------ | ----------------- | ------------------------------------- |
| **Node.js**        | ≥ 20.x            | Chạy Next.js Backend và Vite Frontend |
| **pnpm**           | ≥ 9.x             | Package manager cho monorepo          |
| **Python**         | ≥ 3.10            | Chạy `src/lakehouse/` pipeline        |
| **Docker Desktop** | ≥ 4.x             | Chạy infrastructure services          |
| **MongoDB**        | ≥ 6.x             | Backend catalog database              |
| **Redis**          | ≥ 7.x             | Backend cache + queue                 |




### 4.2 macOS Quick Install

Theo setup hiện tại của project, có thể cài nhanh bằng:

```bash
brew install node python@3.11 pnpm docker mongodb-community redis
```



### 4.3 Preflight Checklist

Trước khi chạy project:

- [ ] Node.js đạt version yêu cầu.
- [ ] `pnpm` có thể chạy từ Terminal.
- [ ] Python ≥ 3.10.
- [ ] Docker Desktop đã mở và Docker Engine sẵn sàng.
- [ ] Có quyền đọc/ghi repository.
- [ ] Port `3001`, `5173`, `9000`, `9001`, `8080`, `8081`, `8088`, `27017`, `6379` chưa bị process khác chiếm.
- [ ] File `.env.example` tồn tại ở repo root.



### 4.4 Quick Version Check

```bash
node --version
pnpm --version
python3 --version
docker --version
docker compose version
```

> [!TIP]
> Nếu chỉ muốn kiểm tra application layer, vẫn cần đảm bảo các dependency mà Backend sử dụng như MongoDB, Redis, MinIO, Kafka và Airflow đã sẵn sàng theo environment hiện tại.

---



## 05. CÀI ĐẶT LẦN ĐẦU (FIRST-TIME SETUP)



### 5.1 Vào Repository Root

Path local hiện tại trong project:

```bash
cd /Users/voanhnhat-ticoder-coder/Documents/data-lake-architure-cloude
```



### 5.2 Cài JavaScript / TypeScript Dependencies

```bash
pnpm install
```

Lệnh này cài dependencies cho monorepo, bao gồm:

- `apps/api/`
- `apps/web/`
- các workspace/package được khai báo trong `pnpm-workspace.yaml`.



### 5.3 Cài Python Package ở Development Mode

```bash
python3 -m pip install -e ".[dev]"
```



### 5.4 Khởi tạo Environment File

```bash
cp -n .env.example .env
```



### 5.5 Setup Verification

```bash
# Node / workspace dependencies
pnpm --version

# Python package
python3 -c "import lakehouse; print('lakehouse import: OK')"

# Environment template
ls -la .env .env.example
```

> [!IMPORTANT]
> `cp -n` không overwrite `.env` nếu file đã tồn tại. Điều này giúp tránh ghi đè cấu hình local đang dùng.



### 5.6 First-time Setup Checklist

- [ ] `pnpm install` hoàn tất không có fatal error.
- [ ] Python package cài được bằng editable mode.
- [ ] `.env` đã tồn tại.
- [ ] Docker Desktop đã sẵn sàng.
- [ ] Chưa đưa secret production vào `.env` local.

---



## 06. DOCKER INFRASTRUCTURE STACK

Infrastructure stack cung cấp storage, compute, messaging, orchestration, BI và các dependency backend.

### 6.1 Khởi động Stack

Mở **Docker Desktop** trước và chờ Docker Engine sẵn sàng, sau đó chạy tại repo root:

```bash
cd /Users/voanhnhat-ticoder-coder/Documents/data-lake-architure-cloude
```

Có ba cách tương đương theo project hiện tại.

#### Cách A — Script

```bash
bash scripts/start.sh
```



#### Cách B — Makefile

```bash
make up
```



#### Cách C — Docker Compose trực tiếp

```bash
docker compose -f docker-compose.yml -f docker-compose-kafka.yml up -d
sleep 60   # đợi service healthcheck / initialization
```



### 6.2 Kiểm tra Container Status

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "lake-"
```



### 6.3 Service Directory — URL & Port


| Service                         | Port    | URL / Connection            | Development Credentials     |
| ------------------------------- | ------- | --------------------------- | --------------------------- |
| **MinIO Console**               | `9001`  | `http://localhost:9001`     | `minioadmin` / `minioadmin` |
| **MinIO API**                   | `9000`  | `http://localhost:9000`     | Internal use                |
| **MongoDB**                     | `27017` | `mongodb://localhost:27017` | No auth (dev)               |
| **Redis**                       | `6379`  | `redis://localhost:6379`    | No auth (dev)               |
| **Redpanda / Kafka**            | `9092`  | `localhost:9092`            | `PLAINTEXT`                 |
| **Redpanda Console / Kafka UI** | `8081`  | `http://localhost:8081`     | —                           |
| **Airflow Webserver**           | `8088`  | `http://localhost:8088`     | `admin` / `admin`           |
| **Spark Master UI**             | `8080`  | `http://localhost:8080`     | —                           |
| **Spark App UI**                | `4040`  | `http://localhost:4040`     | —                           |
| **Metabase**                    | `3000`  | `http://localhost:3000`     | Tạo account lần đầu         |


> [!CAUTION]
> Các credential như `minioadmin/minioadmin` và `admin/admin` trong bảng trên là **development defaults của setup hiện tại**. Không tái sử dụng nguyên trạng cho môi trường public/cloud.



### 6.4 Infrastructure Readiness Checklist

- [ ] Các container chính ở trạng thái running/healthy.
- [ ] MinIO Console mở được ở port `9001`.
- [ ] Redpanda Console mở được ở port `8081`.
- [ ] Airflow Webserver mở được ở port `8088`.
- [ ] Spark Master UI mở được ở port `8080`.
- [ ] MongoDB và Redis sẵn sàng cho Backend.

---



## 07. BACKEND — CONTROL PLANE API

Backend nằm tại `apps/api/`, sử dụng **Next.js 15** và cung cấp khoảng **108 REST routes** để quản lý pipeline, datasets, jobs, quality, lineage và catalog.

### 7.1 Chạy Backend

Mở **Terminal 1**:

```bash
cd /Users/voanhnhat-ticoder-coder/Documents/data-lake-architure-cloude/apps/api
pnpm run dev
```



### 7.2 Expected Startup Output

```text
▲ Next.js 15.x
- Local:        http://127.0.0.1:3001
- Network:      http://<ip-lan>:3001
- Environments: .env.local

✓ Starting...
✓ Ready in ~2s
```



### 7.3 Backend Health Check

```bash
curl -s http://127.0.0.1:3001/api/health | python3 -m json.tool
```

Nếu project expose Swagger docs:

```bash
open http://127.0.0.1:3001/api/docs
```



### 7.4 Main API Endpoints


| Method / Endpoint                 | Mục đích                         |
| --------------------------------- | -------------------------------- |
| `GET /api/health`                 | Health check                     |
| `GET /api/datasets`               | Liệt kê datasets trong Medallion |
| `GET /api/pipelines`              | Liệt kê pipeline + trạng thái    |
| `POST /api/pipelines/:id/trigger` | Trigger pipeline                 |
| `GET /api/jobs`                   | Lịch sử job runs                 |
| `GET /api/data-quality`           | Data quality reports             |
| `GET /api/lineage`                | Data lineage graph               |
| `GET /api/catalog/tables`         | Catalog tables theo Glue-style   |




### 7.5 Backend Environment Configuration

Backend đọc cấu hình từ `apps/api/.env.local` hoặc environment. Bộ biến tối thiểu theo README hiện tại:

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



### 7.6 Development Helper Script

```bash
bash /Users/voanhnhat-ticoder-coder/Documents/data-lake-architure-cloude/scripts/dev-api.sh
```



### 7.7 Backend Troubleshooting


| Symptom                           | Nguyên nhân được xác định trong setup hiện tại | Hướng xử lý                                   |
| --------------------------------- | ---------------------------------------------- | --------------------------------------------- |
| `ECONNREFUSED 127.0.0.1:27017`    | MongoDB chưa chạy                              | Start MongoDB rồi restart BE                  |
| `/api/health` không truy cập được | BE chưa ready / process đã dừng                | Kiểm tra Terminal 1 và startup log            |
| UI báo network error              | FE không gọi được API                          | Xác nhận Backend đang chạy ở `127.0.0.1:3001` |


Nếu MongoDB local chưa chạy:

```bash
mongod --config /opt/homebrew/etc/mongod.conf --fork
```

> [!CAUTION]
> `MINIO_SECRET_KEY`, `AIRFLOW_PASSWORD` và các credential tương tự chỉ nên tồn tại trong local environment / secret-management flow phù hợp. Không commit secret production vào source code.



### 7.8 Backend Readiness Checklist

- [ ] `pnpm run dev` chạy ổn định.
- [ ] Backend listen tại `127.0.0.1:3001`.
- [ ] `GET /api/health` trả response hợp lệ.
- [ ] MongoDB connection không còn `ECONNREFUSED`.
- [ ] Redis / MinIO / Kafka / Airflow configuration đã resolve đúng environment.

---



## 08. FRONTEND — CONTROL PLANE UI

Frontend nằm tại `apps/web/`, sử dụng **React 19 + Vite + Tailwind v3** để cung cấp giao diện quản trị lakehouse.

### 8.1 Chạy Frontend

Mở **Terminal 2** và giữ Terminal 1 của Backend tiếp tục chạy:

```bash
cd /Users/voanhnhat-ticoder-coder/Documents/data-lake-architure-cloude/apps/web
pnpm run dev
```



### 8.2 Expected Startup Output

```text
VITE v5.x  ready in 423 ms

➜  Local:   http://127.0.0.1:5173/
➜  Network: http://<ip-lan>:5173/
➜  press h + enter to show help
```



### 8.3 Truy cập Control Plane UI

```text
http://127.0.0.1:5173/
```



### 8.4 Main UI Routes


| Route        | Chức năng                            |
| ------------ | ------------------------------------ |
| `/`          | Dashboard tổng quan                  |
| `/pipelines` | Danh sách + trigger pipeline         |
| `/datasets`  | Browse Bronze / Silver / Gold tables |
| `/jobs`      | Lịch sử job runs                     |
| `/quality`   | Data Quality dashboard               |
| `/lineage`   | Data lineage graph                   |
| `/crawlers`  | Quản lý crawler: Tiki, GitHub, ...   |
| `/settings`  | Cấu hình connection                  |




### 8.5 Frontend Environment Configuration

Tạo `apps/web/.env.local` hoặc sử dụng default trong `vite.config.ts`:

```bash
VITE_API_BASE_URL=http://127.0.0.1:3001
VITE_APP_NAME="Lakehouse Control Plane"
```



### 8.6 FE ↔ BE Dependency

```text
Browser
   │
   ▼
React / Vite Control Plane UI
http://127.0.0.1:5173
   │
   │ VITE_API_BASE_URL
   ▼
Next.js Control Plane API
http://127.0.0.1:3001
```

> [!WARNING]
> Nếu Backend chưa chạy, các trang Frontend có thể hiển thị `Network Error` hoặc `Failed to fetch`. Luôn kiểm tra Terminal 1 và `GET /api/health` trước khi debug Frontend sâu hơn.



### 8.7 Frontend Readiness Checklist

- [ ] Vite dev server chạy tại `127.0.0.1:5173`.
- [ ] Trang `/` load được.
- [ ] `VITE_API_BASE_URL` trỏ tới Backend port `3001`.
- [ ] Các trang cần API không còn `Failed to fetch`.
- [ ] Backend vẫn đang chạy trong Terminal 1.

---



## 09. END-TO-END VERIFICATION

Sau khi Docker stack, Backend và Frontend đã chạy, tiến hành verification theo thứ tự dưới đây.

### 9.1 Verification Commands

```bash
# 1. Container status
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "lake-"

# 2. API health
curl -s http://127.0.0.1:3001/api/health

# 3. Web load
curl -o /dev/null -w "Web HTTP %{http_code}\n" http://127.0.0.1:5173/

# 4. Open operational UIs
open http://localhost:3001   # API root
open http://localhost:5173   # Web UI
open http://localhost:9001   # MinIO Console
open http://localhost:8088   # Airflow
open http://localhost:8081   # Redpanda Console
open http://localhost:8080   # Spark Master UI
```



### 9.2 Readiness Gate


| Gate           | Expected                                         |
| -------------- | ------------------------------------------------ |
| **Containers** | Core infrastructure containers running / healthy |
| **Backend**    | `/api/health` reachable without connection error |
| **Frontend**   | HTTP response từ port `5173`                     |
| **MinIO**      | Console accessible at `9001`                     |
| **Airflow**    | Webserver accessible at `8088`                   |
| **Redpanda**   | Console accessible at `8081`                     |
| **Spark**      | Master UI accessible at `8080`                   |




### 9.3 Definition of Ready

Platform có thể xem là **ready for pipeline execution** khi:

- [ ] Docker infrastructure đã sẵn sàng.
- [ ] Backend health check pass.
- [ ] Frontend load được.
- [ ] Không còn lỗi `ECONNREFUSED` từ dependency bắt buộc.
- [ ] MinIO / Kafka / Airflow / Spark operational UI truy cập được theo setup hiện tại.

> [!IMPORTANT]
> HTTP `200` áp dụng trực tiếp cho các HTTP endpoint được kiểm tra. Với container/service readiness, cần đồng thời xem container status và application log thay vì chỉ dựa vào một lệnh duy nhất.

---



## 10. PIPELINE EXECUTION

Chỉ chạy pipeline sau khi **Infrastructure + Backend + Frontend + Verification** đã ổn định.

### 10.1 Batch Pipeline — Retail

```bash
cd /Users/voanhnhat-ticoder-coder/Documents/data-lake-architure-cloude

make mock-retail         # Sinh mock data vào data-samples/
make pipeline-batch      # Bronze → Silver → Gold
```

**Flow:**


| Mock Retail Data | →   | Bronze | →   | Silver | →   | Gold |
| ---------------- | --- | ------ | --- | ------ | --- | ---- |




### 10.2 Streaming Pipeline — Clickstream

**Terminal A — Producer**

```bash
make producer-clickstream
```

**Terminal B — Spark Streaming**

```bash
make stream-clickstream
```

**Flow:**

```text
Clickstream Producer
        │
        ▼
Kafka / Redpanda
        │
        ▼
Spark Structured Streaming
        │
        ▼
Lakehouse Streaming Layers
```



### 10.3 Streaming Pipeline — E-commerce + Tiki Crawler

```bash
make crawl-tiki            # Crawl dữ liệu thật từ Tiki.vn
make stream-ecommerce      # Spark streaming job
```



### 10.4 Pipeline Execution Checklist

- [ ] Infrastructure readiness gate đã pass.
- [ ] MinIO accessible.
- [ ] Kafka/Redpanda accessible.
- [ ] Spark available.
- [ ] Input source / mock data đã sẵn sàng.
- [ ] Chọn đúng batch hoặc streaming command.
- [ ] Theo dõi log của producer / Spark job tương ứng.

---



## 11. TEST, LINT & QUALITY GATES

Project cung cấp các Make target cho test và static-quality workflow.

### 11.1 Commands

```bash
make test          # Tất cả test + coverage
make test-fast     # Test không có coverage
make lint          # Ruff lint
make format        # Black + ruff --fix
make typecheck     # Mypy
```



### 11.2 Quality Gate Mapping


| Command          | Mục tiêu                             |
| ---------------- | ------------------------------------ |
| `make test`      | Full test execution + coverage       |
| `make test-fast` | Fast feedback không chạy coverage    |
| `make lint`      | Python linting bằng Ruff             |
| `make format`    | Formatting bằng Black + Ruff autofix |
| `make typecheck` | Static typing bằng Mypy              |




### 11.3 Recommended Development Order

```text
IMPLEMENT / REFACTOR
        │
        ▼
make format
        │
        ▼
make lint
        │
        ▼
make typecheck
        │
        ▼
make test-fast
        │
        ▼
make test
```



### 11.4 Pre-commit Checklist

- [ ] Formatting hoàn tất.
- [ ] Ruff lint pass.
- [ ] Mypy không còn blocking error.
- [ ] Fast tests pass.
- [ ] Full tests + coverage pass khi cần release/review.
- [ ] Không commit `.env` chứa secret thật.

---



## 12. DỪNG, RESET & CLEANUP



### 12.1 Dừng Stack nhưng giữ Data / Volumes



#### Script

```bash
bash scripts/stop.sh
```



#### Makefile

```bash
make down
```



#### Docker Compose

```bash
docker compose -f docker-compose.yml -f docker-compose-kafka.yml down
```



### 12.2 Dừng Backend / Frontend riêng

Tại terminal đang chạy dev server:

```text
Ctrl + C
```



### 12.3 Full Reset — Xóa Volumes



#### Script

```bash
bash scripts/reset.sh
```



#### Makefile

```bash
make clean
```



#### Docker Compose

```bash
docker compose -f docker-compose.yml -f docker-compose-kafka.yml down -v
```

> [!CAUTION]
> `down -v`, `scripts/reset.sh` hoặc `make clean` là **destructive reset** đối với Docker volumes của stack. Chỉ sử dụng khi thực sự muốn reset dữ liệu local.



### 12.4 Shutdown Checklist

- [ ] Dừng producer / streaming job đang chạy.
- [ ] Dừng Backend và Frontend dev servers.
- [ ] Chọn **down** nếu muốn giữ volumes.
- [ ] Chỉ dùng **reset / clean / down -v** khi muốn xóa local state.

---



## 13. TECHNOLOGY STACK


| Layer                        | Technology                             |
| ---------------------------- | -------------------------------------- |
| **Storage**                  | MinIO (S3-compatible) + Delta Lake     |
| **Compute — Batch**          | Apache Spark 3.4 + PySpark             |
| **Compute — Stream**         | Apache Spark Structured Streaming 3.4  |
| **Messaging**                | Apache Kafka / Redpanda                |
| **Orchestration**            | Apache Airflow 2.7                     |
| **BI**                       | Metabase                               |
| **Backend — Control Plane**  | Next.js 15 + TypeScript + tRPC         |
| **Frontend — Control Plane** | React 19 + Vite + Tailwind v3          |
| **Catalog DB**               | MongoDB 6                              |
| **Cache / Queue**            | Redis 7                                |
| **Languages**                | Python 3.10+, TypeScript, SQL          |
| **Monorepo**                 | Nx + pnpm workspaces                   |
| **Cloud Infrastructure**     | Terraform — GCP / AWS / Azure oriented |




### 13.1 Stack by Responsibility


| Responsibility           | Primary Components                                                           |
| ------------------------ | ---------------------------------------------------------------------------- |
| **Ingestion**            | PySpark batch ingestors, Kafka/Redpanda streaming, crawlers, mock generators |
| **Transformation**       | Spark / PySpark                                                              |
| **Storage Format**       | Delta Lake                                                                   |
| **Object Storage**       | MinIO                                                                        |
| **Quality**              | Custom rules + profiling                                                     |
| **Scheduling**           | Airflow                                                                      |
| **Serving / Operations** | Next.js API + React UI                                                       |
| **Analytics**            | Metabase                                                                     |


---



## 14. CẤU TRÚC THƯ MỤC CHI TIẾT (DETAILED REPOSITORY STRUCTURE)

```text
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
│   │
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
├── src/lakehouse/                    # Python package chính
│   ├── core/                         # Spark, paths, env, constants
│   ├── schemas/                      # Centralized schemas
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



### 14.1 Directory Responsibility Summary


| Directory / File      | Vai trò                             |
| --------------------- | ----------------------------------- |
| `apps/api/`           | Backend Control Plane               |
| `apps/web/`           | Frontend Control Plane              |
| `src/lakehouse/`      | Data pipeline package               |
| `tests/`              | pytest tests                        |
| `airflow_dags/`       | Orchestration DAGs                  |
| `scripts/`            | Developer operations scripts        |
| `docker-compose*.yml` | Local service topology              |
| `pyproject.toml`      | Python build/package configuration  |
| `package.json`        | Monorepo root package configuration |
| `Makefile`            | CLI shortcuts                       |
| `data-samples/`       | Mock/sample data                    |
| `configs/`            | Spark/Hive configuration            |
| `docs/`               | Technical documentation             |
| `terraform/`          | Cloud infrastructure                |


---



## 15. TÀI LIỆU THAM KHẢO & LICENSE



### 15.1 Internal Documentation


| Tài liệu                                                                           | Nội dung               |
| ---------------------------------------------------------------------------------- | ---------------------- |
| `[docs/01-architecture-overview.md](docs/01-architecture-overview.md)`             | Tổng quan kiến trúc    |
| `[docs/02-medallion-architecture.md](docs/02-medallion-architecture.md)`           | Bronze / Silver / Gold |
| `[docs/03-etl-vs-elt.md](docs/03-etl-vs-elt.md)`                                   | ETL vs ELT             |
| `[docs/04-data-governance.md](docs/04-data-governance.md)`                         | Data Quality, Security |
| `[docs/05-deployment.md](docs/05-deployment.md)`                                   | Cloud deployment       |
| `[docs/08-kafka-streaming-integration.md](docs/08-kafka-streaming-integration.md)` | Kafka integration      |
| `[docs/09-zero-data-pipeline-setup.md](docs/09-zero-data-pipeline-setup.md)`       | Setup với mock data    |
| `[docs/10-real-crawler-guide.md](docs/10-real-crawler-guide.md)`                   | Real crawler guide     |




### 15.2 License

**MIT License — Free for educational use.**

---



**DATA LAKEHOUSE ARCHITECTURE · LAKEHOUSE V3.0**

MinIO · Delta Lake · Spark · Kafka/Redpanda · Airflow · Next.js · React · Docker · Python

[⬆ Back to top](#top)

