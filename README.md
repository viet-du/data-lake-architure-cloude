# DATA LAKE ARCHITECTURE

**Lakehouse Control Plane** — nền tảng Data Lakehouse chạy `local-first` cho dữ liệu bán lẻ (retail) và thương mại điện tử.

Hệ thống gồm hai phần tách biệt:

- **Data plane (Python + Spark):** nạp dữ liệu batch (CSV/JSON), streaming (Kafka) và crawler vào các bảng Delta theo kiến trúc Medallion **Bronze → Silver → Gold**, lưu trên MinIO (S3-compatible) hoặc Cloudflare R2.
- **Control plane (Next.js API + React Web UI):** REST API và giao diện để duyệt catalog, chạy job, điều khiển crawler, theo dõi Kafka/Airflow, chạy Data Quality và EDA.

Airflow điều phối pipeline, Metabase đọc bản sao PostgreSQL của các bảng Gold để dựng dashboard. Databricks là nguồn đọc/truy vấn tùy chọn. Mọi lệnh ghi (ETL/ELT) mặc định chạy trên MinIO.

---

## Mục lục

| # | Mục | # | Mục |
|---|---|---|---|
| 00 | [Tổng quan dự án](#00-tổng-quan-dự-án) | 14 | [Cấu hình biến môi trường](#14-cấu-hình-biến-môi-trường) |
| 01 | [Năng lực hệ thống](#01-năng-lực-hệ-thống) | 15 | [Quick Start](#15-quick-start) |
| 02 | [Cấu trúc repository](#02-cấu-trúc-repository) | 16 | [Hướng dẫn khởi động từng Terminal](#16-hướng-dẫn-khởi-động-từng-terminal) |
| 03 | [Git integration & tích hợp `dev-v4`](#03-git-integration--tích-hợp-dev-v4) | 17 | [Hướng dẫn chạy pipeline dữ liệu](#17-hướng-dẫn-chạy-pipeline-dữ-liệu) |
| 04 | [Kiến trúc hệ thống](#04-kiến-trúc-hệ-thống) | 18 | [Xác minh API & Frontend](#18-xác-minh-api--frontend) |
| 05 | [Công nghệ sử dụng](#05-công-nghệ-sử-dụng) | 19 | [Vận hành Cloud Storage / R2](#19-vận-hành-cloud-storage--r2) |
| 06 | [Hạ tầng Docker](#06-hạ-tầng-docker) | 20 | [Kiểm thử & bảo đảm chất lượng](#20-kiểm-thử--bảo-đảm-chất-lượng) |
| 07 | [Cloudflare R2](#07-cloudflare-r2) | 21 | [Xử lý sự cố](#21-xử-lý-sự-cố) |
| 08 | [Lưu trữ cục bộ & cơ sở dữ liệu](#08-lưu-trữ-cục-bộ--cơ-sở-dữ-liệu) | 22 | [Logs, giám sát & quan sát](#22-logs-giám-sát--quan-sát) |
| 09 | [Lakehouse & kiến trúc Medallion](#09-lakehouse--kiến-trúc-medallion) | 23 | [Dừng, khởi động lại & dọn dẹp an toàn](#23-dừng-khởi-động-lại--dọn-dẹp-an-toàn) |
| 10 | [Pipeline batch & streaming](#10-pipeline-batch--streaming) | 24 | [Bảo mật & thực hành tốt](#24-bảo-mật--thực-hành-tốt) |
| 11 | [Backend & API](#11-backend--api) | 25 | [Quy trình phát triển & Git](#25-quy-trình-phát-triển--git) |
| 12 | [Frontend & dashboard](#12-frontend--dashboard) | 26 | [Trạng thái kiểm chứng & giới hạn](#26-trạng-thái-kiểm-chứng--giới-hạn) |
| 13 | [Yêu cầu trước khi bắt đầu](#13-yêu-cầu-trước-khi-bắt-đầu) | 27 | [Tài liệu tham khảo & bảo trì](#27-tài-liệu-tham-khảo--bảo-trì) |

> **Ghi chú về độ tin cậy.** Tài liệu này được đối chiếu với `docker-compose*.yml`, `Makefile`, `scripts/`, mã nguồn `src/lakehouse` và `apps/`, và kiểm tra trực tiếp trên stack đang chạy. Mỗi mục có nhãn trạng thái:
>
> | Nhãn | Ý nghĩa |
> |---|---|
> | `SOURCE VERIFIED` | Đọc trực tiếp từ mã nguồn / cấu hình |
> | `GIT VERIFIED` | Xác minh qua lịch sử Git |
> | `CONFIG VERIFIED` | Kiểm tra cấu hình Compose/Makefile/env |
> | `RUNTIME VERIFIED` | Đã chạy và quan sát trên stack đang hoạt động |
> | `DOCUMENTED BUT UNTESTED` | Có cơ sở từ source, chưa chạy thử trên máy này |
> | `PARTIAL` | Mới triển khai một phần |
> | `DEPRECATED` | Đã bị thay thế |
>
> Các lệnh macOS (Apple Silicon) đã được chạy thật. Phần Windows/Linux dựa trên cùng cấu hình Docker nhưng **chưa** được kiểm chứng trực tiếp trên máy đó.

---

## 00. Tổng quan dự án

### 00.1 Vấn đề và mục tiêu

Một dữ liệu bán lẻ thực tế có nguồn đa dạng (CSV hệ thống CRM/ERP, sự kiện clickstream, sản phẩm thương mại điện tử, tín hiệu trending) và cần trả lời các câu hỏi kinh doanh ở nhiều tầng. Dự án giải quyết bốn vấn đề:

1. **Hợp nhất nguồn dữ liệu rời rạc** về một hệ thống lưu trữ có schema và lịch sử phiên bản (Delta Lake).
2. **Tách biệt tầng nghiệp vụ** (Bronze/Silver/Gold) để dữ liệu thô không bị ghi đè và bảng phục vụ phân tích luôn dựng lại được từ dữ liệu gốc.
3. **Không khóa người dùng vào hạ tầng đắt tiền** — toàn bộ stack chạy trên Docker Desktop của một máy cá nhân, có đường nâng cấp sang R2 / Databricks chỉ bằng biến môi trường.
4. **Đưa dữ liệu về gần người dùng** bằng một control plane web có xác thực, phân quyền theo route, hàng đợi job bất đồng bộ và kiểm tra chất lượng dữ liệu.

### 00.2 Tóm tắt kiến trúc

```mermaid
flowchart LR
    subgraph Sources["Nguồn dữ liệu"]
        CSV["CSV/JSON<br/>data-samples"]
        KFK["Kafka topics<br/>7 topics"]
        CRAWL["Crawlers<br/>Tiki / GitHub / HN / Crypto"]
    end

    subgraph Engine["Xử lý"]
        SPARK["Apache Spark 3.5.6<br/>lake-spark-master / worker"]
        AF["Airflow 2.7.0<br/>orchestration"]
    end

    subgraph Lake["Medallion trên S3-compatible"]
        B["Bronze<br/>raw append-only"]
        S["Silver<br/>cleaned / typed"]
        G["Gold<br/>business aggregates"]
    end

    subgraph Storage["Lưu trữ"]
        MINIO["MinIO (local)"]
        R2["Cloudflare R2 (cloud)"]
        PG["PostgreSQL gold_analytics<br/>:5433 mirror cho Metabase"]
    end

    subgraph Control["Control Plane"]
        API["Next.js API :3001"]
        WORKER["BullMQ worker"]
        WEB["React Web UI :5173"]
    end

    META["MongoDB"] --- API
    REDIS["Redis"] --- API
    REDIS --- WORKER

    CSV --> SPARK
    KFK --> SPARK
    CRAWL --> KFK
    AF --> SPARK
    SPARK --> B --> S --> G
    B --> MINIO
    S --> MINIO
    G --> MINIO
    B -. "S3_ENDPOINT" .-> R2
    G --> PG
    G --> DUCK["DuckDB<br/>httpfs + delta"]
    DUCK --> API
    API --> WEB
    API --> WORKER
    WORKER --> SPARK
```

**Quy ước đường dẫn chuẩn** (`src/lakehouse/core/paths.py`, `src/lakehouse/core/datasets.py`):

```text
s3a://lakehouse/{layer}/{database}/{table}
```

Bucket mặc định là `lakehouse` (biến `LAKEHOUSE_BUCKET`). Ví dụ `s3a://lakehouse/bronze/crm/customers`.
Đây là **một** nguồn sự thật cho cả Python lẫn TypeScript; trước đó Python dùng `s3a://{layer}/` (mỗi layer một bucket) nên hai nửa hệ thống không thấy cùng một bảng. Xem `src/lakehouse/core/datasets.py` để biết ánh xạ bảng → database.

### 00.3 Ba tầng dữ liệu

| Tầng | Nội dung | Tính chất |
|---|---|---|
| **Bronze** | Dữ liệu thô giữ nguyên cấu trúc nguồn, thêm metadata nạp | Append/MERGE theo khóa tự nhiên, idempotent |
| **Silver** | Đã làm sạch, ép kiểu, khử trùng lặp, làm giàu | Bảng chuẩn hóa theo `database.table` |
| **Gold** | Tổng hợp nghiệp vụ phục vụ phân tích | `fact_orders`, `dim_customers`, `dim_products`, `daily_revenue` |

### 00.4 Hai biến cấu hình độc lập, dễ nhầm

| Biến | Ý nghĩa | Giá trị |
|---|---|---|
| `LAKEHOUSE_DATA_SOURCE` | Nơi API **đọc** mặc định | `local` \| `databricks` |
| `LAKEHOUSE_EXECUTION_TARGET` | Nơi job **ghi** chạy | `local_delta_minio` \| `databricks_uc` |

`databricks_uc` **chưa được hiện thực** — mọi thao tác ghi tới nó bị từ chối với mã `DATABRICKS_READ_ONLY`. Nhờ tách hai biến này, bạn có thể đọc dữ liệu từ Databricks nhưng vẫn ghi vào MinIO. (`SOURCE VERIFIED` — `src/lakehouse/core/datasets.py`)

---

## 01. Năng lực hệ thống

### 01.1 Đã triển khai và kiểm chứng

| Nhóm | Nội dung | Trạng thái |
|---|---|---|
| Lakehouse | Bảng Delta Lake 3.0 trên MinIO, 3 tầng trong bucket `lakehouse` | `RUNTIME VERIFIED` — 780 object trong `lakehouse/` |
| Batch | Sinh dữ liệu giả (200 khách hàng, 50 sản phẩm, 1000 đơn), nạp CSV/JSON → Bronze → Silver → Gold | `RUNTIME VERIFIED` — có data thật trong `bronze/crm/customers` |
| Streaming | Kafka 7 topic, Spark Structured Streaming cho `clickstream` và `ecommerce` | `RUNTIME VERIFIED` — 7 topic, checkpoint đã ghi vào `bronze/_checkpoints/` |
| Crawler | Tiki (5 danh mục), GitHub trending, HackerNews, Crypto; scheduler 8 job | `SOURCE VERIFIED` — 8 job trong `build_default_scheduler()` |
| Orchestration | Airflow 2.7.0, 4 DAG | `RUNTIME VERIFIED` — 4 DAG import sạch, không có import error |
| Query engine | Spark 3.5.6 ghi; DuckDB nhúng (`httpfs` + `delta`) đọc trong API | `RUNTIME VERIFIED` — DuckDB `up`, latency 156 ms |
| Metadata | MongoDB (catalog, job, DQ rule, EDA profile, audit); Redis (cache + BullMQ) | `RUNTIME VERIFIED` — Mongo 14 ms, Redis 31 ms |
| Control Plane | Next.js 15 API (:3001), React 19 + Vite Web UI (:5173) | `RUNTIME VERIFIED` — HTTP 200 |
| Worker | BullMQ consumer cho 4 hàng đợi: bronze / silver / gold / crawler | `RUNTIME VERIFIED` — container `lake-worker` đang chạy |
| BI | Gold Delta → PostgreSQL `gold_analytics` để Metabase đọc | `RUNTIME VERIFIED` — 4 bảng trong schema `public` |
| Data Quality | 6 loại rule, suite, preset, quality gate | `SOURCE VERIFIED` |
| EDA | Profile dữ liệu, thống kê cột, biểu đồ, so sánh, đề xuất rule | `SOURCE VERIFIED` |
| Xác thực | JWT + 4 vai trò + policy theo route + audit log | `RUNTIME VERIFIED` — `policy.service.ts` có 60+ rule |
| Cloudflare Pages | Deploy frontend tĩnh + Quick Tunnel tới API local | `DOCUMENTED BUT UNTESTED` — lệnh đã xác minh, không deploy trong phiên audit này |

### 01.2 Triển khai một phần

| Hạng mục | Phần đã có | Phần còn thiếu |
|---|---|---|
| Cloudflare R2 | Spark đọc/ghi qua S3A khi `S3_ENDPOINT` được đặt; script replicate MinIO → R2; lifecycle policy trong `infra/r2/` | Chưa chạy thử với bucket R2 thật trong phiên audit |
| Databricks | Client, bridge, bootstrap script, path mode `volume`/`dbfs` | `databricks_uc` execution target chưa hiện thực; chỉ đọc |
| Airflow web UI | 4 DAG, scheduler, log | Chưa có trigger tự động cho `retail_elt_dag` (`schedule_interval=None`) |

### 01.3 Đã loại bỏ / deprecated

| Thành phần | Trạng thái |
|---|---|
| Hive Metastore (`apache/hive:3.1.3`) | Đã gỡ khỏi Compose ở PHASE 2. Delta Lake dùng `_delta_log/` riêng, không mã nào truy vấn metastore |
| Redpanda + Redpanda Console | Đã loại — không có code path nào tham chiếu `redpanda:9192` |
| `docker-compose.api.yml.deprecated` | File cũ, không dùng. Dùng `docker-compose.dev-api.yml` |
| Topic `weather-stream` | `kafka-init` không tạo; crawler weather đã bị gỡ ngày 2026-10-14 (không nối được với dữ liệu nghiệp vụ) |

---

## 02. Cấu trúc repository

```text
.
├── apps/
│   ├── api/                  Control Plane API (Next.js 15, TypeScript)
│   │   ├── src/app/api/      131 route handler REST
│   │   ├── src/modules/      18 module: airflow, bronze, catalog, crawler, dashboard,
│   │   │                     datasets, dq, eda, gold, gold-queries, health, kafka,
│   │   │                     operations, security, silver
│   │   ├── src/workers/      main.ts — consumer BullMQ cho 4 hàng đợi
│   │   ├── src/lib/infra/    Client DuckDB, Databricks, Kafka, Spark job-runner
│   │   ├── env-loader.js     Bộ nạp biến môi trường chuẩn (dùng chung với Python)
│   │   ├── Dockerfile        Image API (node:20-bookworm-slim — glibc, không Alpine)
│   │   └── Dockerfile.worker Image worker (FROM lake-airflow:2.7.0, có Python + Spark)
│   └── web/                  Web UI (React 19 + Vite 5 + Tailwind 3), build ra nginx
│       ├── src/screens/      12 màn hình + login.view.tsx
│       ├── src/navigation/   ROUTES, Layout
│       ├── src/services/     Client API theo domain
│       ├── src/store/        Zustand: auth, theme
│       ├── nginx.conf        Proxy /api → http://api:3001
│       └── e2e/              Playwright specs
├── airflow_dags/             4 DAG: retail_elt, crawler, clickstream_streaming, ecommerce_streaming
├── src/lakehouse/            Gói Python `lakehouse` (pyproject.toml, v2.0.0)
│   ├── core/                 env, paths, spark, constants, datasets, databricks_bridge
│   ├── ingest/batch/         csv_ingestor, json_ingestor, source_resolver
│   ├── ingest/streaming/     clickstream, ecommerce, bounded_stream_ingestor
│   ├── transform/batch/      customers, products, orders
│   ├── aggregate/batch/      fact_orders, dim_customers, dim_products, daily_revenue
│   ├── aggregate/streaming/  category_revenue, clickstream_metrics, ecommerce_metrics
│   ├── pipelines/            batch_retail, stream_clickstream, stream_ecommerce
│   ├── jobs/                 runner.py + protocol.py — CLI job mà API/worker gọi
│   ├── sources/              mock generator, crawlers, producers, scheduler
│   ├── quality/              checks.py (Data Quality Python)
│   ├── storage/              delta_writer
│   ├── sync/                 r2_replicate (MinIO → R2)
│   └── tools/                sync_gold_to_postgres, verify_minio_delta, crawler_minio_etl
├── scripts/                  37 script vận hành (start, stop, reset, verify, pipeline, R2, Databricks)
├── configs/                  spark-defaults.conf
├── data-samples/             Dữ liệu đầu vào cục bộ (gitignored, tự sinh)
├── sql/ notebooks/ experiments/ terraform/ infra/r2/
├── tests/                    20 file pytest
├── docs/                     Kiến trúc, vận hành, API, handbook, cloud
├── docker-compose.yml        Hạ tầng lõi: MinIO, Postgres, Spark, Airflow, Metabase, Mongo, Redis
├── docker-compose-kafka.yml  ZooKeeper, Kafka, Kafka UI, kafka-init (tạo 7 topic)
├── docker-compose.dev-api.yml Lớp phủ tùy chọn: api, worker, web
├── Dockerfile.airflow        Image Airflow 2.7.0 + JDK 17 + JAR Spark/Delta/S3A/Kafka
├── Dockerfile.spark-runtime  Image Spark master/worker + venv Python
├── Makefile                  57 target (`make help`)
├── pyproject.toml            Khai báo gói Python `lakehouse`
├── package.json, pnpm-workspace.yaml   Workspace pnpm (apps/*)
└── .env.example, .env.databricks.template   Mẫu biến môi trường
```

**Quy ước cây thư mục `src` của Python và TypeScript không được trùng nhau.** Worker image đặt Python ở `/app/lakehouse-src` và TypeScript ở `/app/apps/api/src` để bind mount không che khuất nhau. `SOURCE VERIFIED` — `apps/api/Dockerfile.worker`

---

## 03. Git integration & tích hợp `dev-v4`

> Phần này trả lời: *nhánh `dev-v4` đã được merge vào `main` chưa, và merge mang lại những gì?*
> Tất cả kết luận dưới đây đều lấy từ `git` trên repo thật. `GIT VERIFIED`

### 03.1 Trạng thái nhánh

```bash
git branch -avv
```

```text
  dev                              79bb2aa [origin/dev] chore: sync project changes
  dev-v3                           1feadc1 [origin/dev-v3] fix: remove leaked Metabase API key from .env.example
  feat/spark-arm64-and-docs        bbf3e49 [origin/feat/spark-arm64-and-docs: ahead 3]
* main                             16a0f05 [origin/main: ahead 4] docs(operations): add runbook for restarting Docker, R2 and the Pages tunnel
  remotes/origin/dev-v4            28e39a7 Refactor UI for Data Lake and refactor set up some function
```

| Mục | Giá trị |
|---|---|
| Nhánh hiện tại | `main` |
| HEAD | `16a0f05` — **ahead `origin/main` 4 commit** (chưa push) |
| Nhánh phát triển | `dev` (`79bb2aa`), `dev-v2`, `dev-v3`, `dev-v4`, `feat/spark-arm64-and-docs` |
| Remote | `origin` (`origin/HEAD → origin/main`) |

### 03.2 `dev-v4` đã được tích hợp vào `main` chưa?

**Có — bằng fast-forward, không phải merge commit.**

```bash
git merge-base --is-ancestor origin/dev-v4 main && echo YES
# → YES
git merge-base main origin/dev-v4
# → 28e39a7ba16a33a97bd3981709ec447848fbb9e2
git log --oneline origin/dev-v4..main
# → 16a0f05 docs(operations): add runbook …
# → 9d0e5b0 fix(web): keep Docker-only API hostname out of the browser bundle
# → 7b63257 feat(web): add login gate and align role union with API roles
# → cd93c8c fix(api): allow root layer routes and ship gold SQL assets …
# → bbfcf76 fix: update Airflow and web integration config
git log --oneline main..origin/dev-v4
# → (rỗng)
```

Bằng chứng:

- `28e39a7` (tiêu đề `origin/dev-v4`) là **ancestor** của HEAD `16a0f05` trong `git log --graph`; `28e39a7` là parent trực tiếp của `bbfcf76`, và `bbfcf76` lại là parent của `cd93c8c`.
- `main..origin/dev-v4` rỗng ⇒ không còn commit nào trên `dev-v4` chưa có trong `main`.
- Không tồn tại merge commit nào trong `main`; nhánh được đưa vào bằng fast-forward.

> **Lưu ý phân biệt:** `origin/dev-v4` vẫn tồn tại như một *remote-tracking ref* trỏ tới commit cũ. Sự tồn tại của ref **không** phải bằng chứng merge; bằng chứng là quan hệ ancestor ở trên.

### 03.3 Nội dung tích hợp `dev-v4` (phạm vi `1feadc1..28e39a7`)

Diff thống kê: **444 file, +32.723 / −1.732 dòng**.

| Nhóm | Thay đổi | Bằng chứng |
|---|---|---|
| **Hạ tầng Docker** | Thêm `restart: unless-stopped` cho `postgres`, `gold-postgres`, `zookeeper`, `kafka` | `docker-compose.yml`, `docker-compose-kafka.yml` |
| **Hạ tầng Docker** | Giảm `SPARK_WORKER_MEMORY` 2g → 1g, `SPARK_EXECUTOR_MEMORY` → 768m (tránh OOM executor) | `docker-compose.yml` |
| **Control Plane** | **Thêm service `worker`** (BullMQ consumer) vào `docker-compose.dev-api.yml` | `docker-compose.dev-api.yml` |
| **Control Plane** | `MONGO_URI` của API/worker có xác thực `mongoadmin:mongoadmin` | `docker-compose.dev-api.yml` |
| **Data plane** | Thêm `src/lakehouse/core/datasets.py` (200 dòng) — định danh dataset chuẩn | `src/lakehouse/core/datasets.py` |
| **Data plane** | Thêm `src/lakehouse/core/env.py` (362 dòng) — bộ nạp env chuẩn cho Python | `src/lakehouse/core/env.py` |
| **Data plane** | Thêm `src/lakehouse/core/paths.py` (182 dòng) — chuẩn hoá đường dẫn theo storage env | `src/lakehouse/core/paths.py` |
| **Data plane** | Thêm `src/lakehouse/ingest/batch/source_resolver.py` (191 dòng) | — |
| **Data plane** | Thêm `src/lakehouse/ingest/streaming/bounded_stream_ingestor.py` (308 dòng) | — |
| **Data plane** | Thêm `src/lakehouse/jobs/` — `protocol.py` + `runner.py` (495 dòng): CLI job cho worker gọi | — |
| **Data plane** | `src/lakehouse/core/spark.py` mở rộng 145 dòng (S3A/R2, quản lý JAR) | — |
| **Frontend** | Thêm `apps/web/src/types/entities/eda/eda.entity.ts` (320 dòng) | — |
| **Test** | Thêm `tests/test_env_parity.py` (242 dòng) — chứng minh loader Python và JS cho kết quả giống nhau | — |
| **Test** | Sửa `tests/test_lake_paths.py`, `tests/test_paths.py`, `tests/test_streaming_correctness.py` | — |
| **Config** | `configs/spark-defaults.conf` (22 dòng) | — |
| **Tài liệu** | `docs/UI_API_INTEGRATION.md`, `docs/implementation-progress.md`, `source-gap-register.md`, `DATA_LAKEHOUSE_..._MASTER_PLAN_2026-10-24.md` (1.006 dòng) | — |
| **Script thử nghiệm** | `scripts/_tmp_run_bronze.sh`, `scripts/probe_delta_write.py`, `scripts/probe_delta_detail.py` | Tạm, không phải đường chạy chính |

### 03.4 Các commit trên `main` sau tích hợp `dev-v4`

#### `bbfcf76` — fix: update Airflow and web integration config

Diff: **5 file, +272 / −10**.

| Thay đổi | Chi tiết |
|---|---|
| `airflow_dags/retail_elt_dag.py` | Thêm `max_active_tasks=1` — mỗi DAG chạy 1 task tại một thời điểm để tránh spike bộ nhớ |
| `docker-compose.yml` | `AIRFLOW__API__AUTH_BACKENDS` thêm `session` backend cho cả webserver và scheduler |
| `docker-compose.yml` | Scheduler thêm `AIRFLOW__CORE__MAX_ACTIVE_TASKS_PER_DAG=1` |
| `apps/web/Dockerfile` | Bỏ stage `deps` riêng, gộp `pnpm install --frozen-lockfile` vào stage `builder` |
| `UI_API_INTEGRATION.md` | Tài liệu mới (228 dòng) |
| `tests/test_airflow_dag_config.py` | Test mới (37 dòng) khẳng định cấu hình DAG |

#### 4 commit sửa lỗi (chưa push)

| Commit | Phạm vi | Nội dung |
|---|---|---|
| `cd93c8c` | `fix(api)` | Regex policy `bronze`/`silver`/`gold` thêm `(?:\/\|$)` để route gốc không trả `403 UNKNOWN_ROUTE`; copy thư mục `gold-queries/sql` vào runtime image để hết `500 ENOENT` |
| `7b63257` | `feat(web)` | Thêm `LoginView`, gate route sau `isAuthenticated`, nút đăng xuất + email trên header, chuỗi `auth.*` cho en/vi, thêm role `analyst` vào `EUserRole` |
| `9d0e5b0` | `fix(web)` | Bỏ `VITE_API_BASE_URL=http://api:3001` khỏi Compose (hostname Docker lọt vào JS trình duyệt); thêm `ARG VITE_API_BASE_URL` vào Dockerfile; thu hẹp build context; ignore `**/node_modules` |
| `16a0f05` | `docs(operations)` | Runbook restart Docker + R2 + Quick Tunnel; ignore `R2_ENV_KEYS.txt` |

> Chi tiết kỹ thuật của từng lỗi nằm ở mục 11.2 (SQL asset), 11.3 (policy regex), 12.2–12.3 (login gate, `VITE_API_BASE_URL`) và mục 24.3 (Pages + tunnel).

### 03.5 Bảng tổng hợp

| Thành phần | Trước tích hợp | `main` hiện tại | Bằng chứng | Trạng thái |
|---|---|---|---|---|
| Service `worker` | Không có | Có, chạy `python -m lakehouse.jobs.runner` | `docker-compose.dev-api.yml` | `RUNTIME VERIFIED` |
| `MONGO_URI` API | `mongodb://mongo:27017` (không xác thực → lệnh bị từ chối) | `mongodb://mongoadmin:mongoadmin@mongo:27017/?authSource=admin` | compose diff | `RUNTIME VERIFIED` |
| `restart` policy | Mặc định `no` | `unless-stopped` cho Postgres/Gold/ZK/Kafka | compose diff | `SOURCE VERIFIED` |
| Định danh dataset | Python `s3a://{layer}/`, TS `s3://lakehouse/{layer}/` | Cả hai về `s3a://lakehouse/{layer}/{database}/{table}` | `core/datasets.py` + `core/paths.py` | `RUNTIME VERIFIED` |
| Bộ nạp env | Rời rạc mỗi nửa | Một grammar, hai runtime (Python + JS), test parity | `core/env.py`, `env-loader.js`, `tests/test_env_parity.py` | `TESTED PASS` (test tồn tại) |
| CLI job runner | Không có | `lakehouse.jobs.runner` có allowlist operation | `jobs/protocol.py` | `RUNTIME VERIFIED` |
| Airflow session auth | Chỉ `basic_auth` | `basic_auth` + `session` | `bbfcf76` diff | `RUNTIME VERIFIED` |
| Serialise task DAG | Song song | `max_active_tasks=1` | `bbfcf76` diff | `RUNTIME VERIFIED` |

### 03.6 Thay đổi trong 4 commit sửa lỗi

Các thay đổi sau **đã được commit** (xem mục 03.4) nhưng **chưa push** lên `origin/main`.

| File | Thay đổi | Ảnh hưởng vận hành |
|---|---|---|
| `apps/api/src/modules/security/services/policy.service.ts` | Regex root `bronze`/`silver`/`gold` đổi từ `/api/x/` thành `/api/x(?:\/\|$)` | Sửa lỗi `403 UNKNOWN_ROUTE` khi GET `/api/bronze` |
| `apps/api/Dockerfile` | Thêm `COPY --from=builder /app/src/modules/gold-queries/sql ./src/modules/gold-queries/sql` | Sửa lỗi `500 ENOENT` khi chạy truy vấn Gold |
| `apps/web/src/screens/login.view.tsx` *(mới)* | Màn hình đăng nhập email/password | Bổ sung cho luồng auth |
| `apps/web/src/App.tsx` | Gate toàn bộ route sau `isAuthenticated` | Bắt buộc đăng nhập mới vào được UI |
| `apps/web/src/store/auth.store.ts` | Thêm role `analyst` vào union type | Khớp với 4 vai trò phía API |
| `apps/web/src/navigation/layout/layout.component.tsx` | Hiện email + nút đăng xuất trên header | — |
| `apps/web/src/i18n/locales/{en,vi}.json` | Chuỗi `auth.*` | Bản dịch cho màn hình login |
| `apps/web/Dockerfile` | Thêm `ARG VITE_API_BASE_URL`, chỉ copy `apps/web` vào build context | Cho phép build frontend với URL tunnel khác |
| `docker-compose.dev-api.yml` | Bỏ `VITE_API_BASE_URL=http://api:3001` khỏi env `web` | Nginx proxy `/api` → `api:3001`; hostname `api` không lọt vào JS trình duyệt |
| `.dockerignore`, `.gitignore` | Bổ sung pattern `**/node_modules`, `R2_ENV_KEYS.txt` | — |
| `docs/operations/RESTART_LOCAL_R2_TUNNEL.md` *(mới)* | Runbook restart Docker + R2 + tunnel | — |
| `README.md` | File này | — |

---

## 04. Kiến trúc hệ thống

### 04.1 Sơ đồ thành phần

```mermaid
flowchart TB
    subgraph CP["Control Plane — apps/api + apps/web"]
        WEB["React 19 + Vite<br/>:5173 (nginx)"]
        API["Next.js 15 API<br/>:3001"]
        WK["BullMQ Worker<br/>python -m lakehouse.jobs.runner"]
        DUCK["DuckDB 1.5<br/>httpfs + delta"]
        WEB -->|"/api proxy"| API
        API --> DUCK
    end

    subgraph INF["Infrastructure — Docker Compose"]
        MINIO[("MinIO<br/>:9000 / :9001")]
        MONGO[("MongoDB 7<br/>:27017")]
        REDIS[("Redis 7<br/>:6379")]
        KFK[("Kafka 7.5<br/>:9092 / :29092")]
        ZK[("ZooKeeper<br/>:2181")]
        KUI["Kafka UI<br/>:8081"]
        SMB[("Spark Master<br/>:8080 / :7077")]
        SW[("Spark Worker<br/>:4040")]
        MB["Metabase<br/>:3000"]
        GP[("Gold Postgres<br/>:5433")]
        AFW["Airflow Web<br/>:8088"]
        AFS["Airflow Scheduler"]
        AFD[("Airflow DB<br/>:5432")]
        PM[("Metastore PG<br/>:5432")]
    end

    API --> MONGO
    API --> REDIS
    API --> MINIO
    API --> KFK
    API --> AFW
    API --> DUCK
    DUCK --> MINIO
    WK --> REDIS
    WK -->|"spark-submit"| SMB
    WK --> MONGO
    SW --> SMB
    ZK --> KFK
    KUI --> KFK
    AFD --> AFW
    AFD --> AFS
    AFW --> AFS
    AFS -->|"docker exec spark-submit"| SMB
    SMB --> PM
    MB --> GP
```

### 04.2 Luồng dữ liệu end-to-end

**Luồng ghi (ETL/ELT):**

```text
CSV/JSON (data-samples)
  → Spark csv_ingestor / json_ingestor        → s3a://lakehouse/bronze/{db}/{table}
  → Spark customers/products/orders transformer → s3a://lakehouse/silver/{db}/{table}
  → Spark fact/dim/daily_revenue aggregator     → s3a://lakehouse/gold/retail/{table}
  → sync_gold_to_metabase.sh                    → PostgreSQL gold_analytics.public.*
  → Metabase                                     → http://localhost:3000
```

**Luồng đọc (serving):**

```text
Trình duyệt → Web UI (:5173)
  → /api/* → Next.js API (:3001)
  → DuckDB đọc Delta trên MinIO/R2 (qua S3A httpfs)
  → trả JSON
```

**Luồng job bất đồng bộ (Control Plane):**

```text
Người dùng bấm "Transform" trên UI
  → POST /api/silver/{table}/transform
  → API ghi job vào MongoDB + đẩy vào hàng đợi BullMQ (Redis)
  → worker nhận job → spawn `python -m lakehouse.jobs.runner '<json>'`
  → runner chạy Spark (local[2]) trong container worker
  → kết quả ghi vào Delta + cập nhật job trong MongoDB
  → UI poll lại trạng thái job
```

**Luồng streaming:**

```text
Kafka topic (7 topic, 3 partition, RF=1)
  → Spark Structured Streaming (trigger_available_now)
  → bronze/{clickstream|ecommerce}/*  + checkpoint tại bronze/_checkpoints/
  → Silver transformer → Gold aggregator
```

> **Phân biệt quan trọng:** streaming ở đây dùng `trigger_available_now` — xử lý hết dữ liệu đang có trong topic rồi **tự dừng**, không chạy vô hạn. Job chạy liên tục chỉ khi bật DAG Airflow theo lịch (mỗi giờ) và có `continuous` processing mode. `SOURCE VERIFIED` — `src/lakehouse/pipelines/stream_*.py`

---

## 05. Công nghệ sử dụng

| Lớp | Công nghệ | Phiên bản (theo repo) | Runtime |
|---|---|---|---|
| Lưu trữ đối tượng | MinIO (`cgr.dev/chainguard/minio`) | `latest` | Docker |
| Lưu trữ đối tượng (cloud) | Cloudflare R2 (S3-compatible) | — | Cloud |
| Định dạng bảng | Delta Lake (`io.delta:delta-spark_2.12`) | 3.0.0 | Docker / host |
| Xử lý | Apache Spark (Bitnami legacy) | 3.5.6 | Docker |
| Xử lý (Python) | PySpark | `>=3.4,<3.6` | `.venv` |
| Truy vấn nhúng | DuckDB (`@duckdb/node-api`) | 1.5.x | Docker |
| Streaming | Kafka + ZooKeeper (Confluent) | 7.5.0 | Docker |
| Giao diện Kafka | `provectuslabs/kafka-ui` | `latest` | Docker |
| Điều phối | Apache Airflow (LocalExecutor) | 2.7.0, Python 3.11 | Docker |
| Cơ sở dữ liệu metadata | MongoDB | 7 | Docker |
| Cache + hàng đợi | Redis (`redis:7-alpine`), BullMQ | 7 / `^5.81.5` | Docker |
| PostgreSQL | Metastore (13), Airflow DB (13), Gold mirror (16-alpine) | 13 / 16 | Docker |
| BI | Metabase | `latest` | Docker |
| API | Next.js, TypeScript, Zod, Mongoose, kafkajs, ioredis, BullMQ, pino | Next 15, React 19 | Docker |
| Web | React 19, Vite 5, Tailwind 3, TanStack Query, i18next (EN/VI), three.js, zustand | — | Docker / host |
| Python | Gói `lakehouse` (pyspark, delta-spark, kafka-python, boto3, minio, pandas, great-expectations) | Python `>=3.10` | `.venv` |
| Java | Temurin JDK 17 (trong image Airflow) | 17.0.10+7 | Docker |
| Hạ tầng | Docker Compose, Makefile, GitHub Actions CI, Terraform | — | Host |

### 05.1 Phiên bản runtime đã kiểm chứng

| Thành phần | Giá trị quan sát được |
|---|---|
| Docker Engine | 29.7.2 |
| Docker Compose | v5.4.0 |
| Docker resources | 8 CPU, 8.319.770.624 bytes RAM (≈7,75 GiB) |
| Kiến trúc | `aarch64` (Apple Silicon) |
| `lake-api` | healthy, HTTP 200 |
| `lake-web` | healthy, HTTP 200 |
| `lake-airflow-webserver` | healthy, HTTP 200 |
| `lake-minio` | healthy, HTTP 200 |
| `lake-kafka` / `lake-zookeeper` | healthy |
| `lake-mongo` / `lake-redis` | healthy |
| `lake-gold-postgres` | healthy, TCP 5433 mở |
| `lake-worker` | running (không có healthcheck → hiển thị `Up`) |

---

## 06. Hạ tầng Docker

### 06.1 Ba file Compose

| File | Service | Khi nào dùng |
|---|---|---|
| `docker-compose.yml` | `minio`, `minio-init`, `postgres`, `gold-postgres`, `spark-master`, `spark-worker`, `airflow-db`, `airflow-webserver`, `airflow-scheduler`, `metabase`, `mongo`, `redis` | Luôn luôn |
| `docker-compose-kafka.yml` | `zookeeper`, `kafka`, `kafka-ui`, `kafka-init` | Luôn luôn (`make up` đã gộp sẵn) |
| `docker-compose.dev-api.yml` | `api` (:3001), `worker`, `web` (:5173) | Khi muốn Control Plane |

Lệnh tương đương:

```bash
# Core + Kafka
docker compose -f docker-compose.yml -f docker-compose-kafka.yml up -d

# Core + Kafka + Control Plane
docker compose -f docker-compose.yml -f docker-compose-kafka.yml -f docker-compose.dev-api.yml up -d
```

`docker compose config --services` xác nhận: core+kafka → 16 service; +dev-api → 19 service. `CONFIG VERIFIED`

### 06.2 Ma trận service

| Service | Container | Image | Cổng host | Phụ thuộc | Health check | Lệnh khởi động |
|---|---|---|---|---|---|---|
| `minio` | `lake-minio` | `cgr.dev/chainguard/minio:latest` | 9000, 9001 | — | TCP probe `:9000` | `server /data --console-address ":9001"` |
| `minio-init` | `lake-minio-init` | `bitnamilegacy/minio-client` | — | minio healthy | — | `mc mb` cho `bronze`/`silver`/`gold` + prefix con |
| `postgres` | `lake-postgres` | `postgres:13` | (không publish) | — | `pg_isready -U hive` | — |
| `gold-postgres` | `lake-gold-postgres` | `postgres:16-alpine` | 5433 | — | `pg_isready` | — |
| `spark-master` | `lake-spark-master` | `lake-spark:3.5.6` | 8080, 7077, 4040 | gold-postgres healthy | `curl localhost:8080` | Bitnami Spark master |
| `spark-worker` | `lake-spark-worker` | `lake-spark:3.5.6` | (4040 chung) | spark-master healthy | `curl spark-master:8080` | Bitnami Spark worker |
| `airflow-db` | `lake-airflow-db` | `postgres:13` | (không publish) | — | `pg_isready -U airflow` | `shm_size: 256mb` |
| `airflow-webserver` | `lake-airflow-webserver` | `lake-airflow:2.7.0` | 8088 | airflow-db healthy | HTTP `:8080` + `airflow db check` | `airflow db init` → tạo user admin → `airflow webserver` |
| `airflow-scheduler` | `lake-airflow-scheduler` | `lake-airflow:2.7.0` | (không publish) | airflow-db + webserver healthy | `airflow jobs check` | `airflow scheduler` |
| `metabase` | `lake-metabase` | `metabase/metabase:latest` | 3000 | — | `wget /api/health` | H2, volume `metabase_data` |
| `mongo` | `lake-mongo` | `mongo:7` | 27017 | — | `mongosh ping` | `mongoadmin`/`mongoadmin` |
| `redis` | `redis:7-alpine` | `redis:7-alpine` | 6379 | — | `redis-cli ping` | `--appendonly yes` |
| `zookeeper` | `lake-zookeeper` | `confluentinc/cp-zookeeper:7.5.0` | 2181 | — | `echo ruok \| nc` | volume `zookeeper_data_v2` |
| `kafka` | `lake-kafka` | `confluentinc/cp-kafka:7.5.0` | 9092, 29092 | zookeeper healthy | `kafka-topics --list` | volume `kafka_data_v2` |
| `kafka-ui` | `lake-kafka-ui` | `provectuslabs/kafka-ui:latest` | 8081 | kafka healthy | `wget localhost:8080` | — |
| `kafka-init` | `lake-kafka-init` | `confluentinc/cp-kafka:7.5.0` | — | kafka healthy | — | Tạo 7 topic, 3 partition, RF=1 |
| `api` | `lake-api` | build `apps/api/Dockerfile` | 3001 | mongo started, redis/minio/airflow-webserver healthy | Node fetch `:3001/api/health` | `npm start` |
| `worker` | `lake-worker` | build `apps/api/Dockerfile.worker` | — | mongo started, redis/minio healthy | (không có) | `node …/tsx/dist/cli.mjs src/workers/main.ts` |
| `web` | `lake-web` | build `apps/web/Dockerfile` | 5173 | api started | nginx | nginx proxy `/api` → `api:3001` |

**Named volumes:** `minio_data`, `postgres_data`, `gold_postgres_data`, `airflow_db_data`, `metabase_data`, `mongo_data`, `redis_data`, `kafka_data_v2`, `zookeeper_data_v2`, `zookeeper_log_v2`.

### 06.3 Thứ tự khởi động

```mermaid
flowchart TD
    A["Mở Docker Desktop"] --> B["docker version + compose version"]
    B --> C["Build image tuần tự<br/>COMPOSE_PARALLEL_LIMIT=1"]
    C --> D["docker compose ... up -d<br/>(core + kafka)"]
    D --> E{"Container healthy?"}
    E -->|Không| F["docker logs &lt;container&gt;<br/>kiểm tra .env"]
    F --> D
    E -->|Có| G["Tạo bucket 'lakehouse'<br/>(minio-init KHÔNG tạo)"]
    G --> H["docker compose ... up -d<br/>+ dev-api overlay"]
    H --> I{"API healthy?"}
    I -->|Không| J["docker logs lake-api<br/>kiểm tra .env.local"]
    J --> H
    I -->|Có| K["Kiểm tra Web :5173"]
    K --> L["Chạy pipeline / truy vấn"]
```

Chi tiết `depends_on`:

| Container | Chờ |
|---|---|
| `minio-init` | `minio` healthy |
| `kafka` | `zookeeper` healthy |
| `kafka-ui`, `kafka-init` | `kafka` healthy |
| `spark-master` | `gold-postgres` healthy |
| `spark-worker` | `spark-master` healthy |
| `airflow-webserver` | `airflow-db` healthy |
| `airflow-scheduler` | `airflow-db` healthy **+** `airflow-webserver` healthy |
| `api` | `mongo` started, `redis` healthy, `minio` healthy, `airflow-webserver` healthy |
| `worker` | `mongo` started, `redis` healthy, `minio` healthy |
| `web` | `api` started |

> **"Container running" ≠ "sẵn sàng".** Ví dụ `api` chỉ `depends_on` Airflow ở mức *healthy*, còn Airflow webserver cần `start_period: 60s` và chạy `airflow db init` — lần khởi động đầu mất 1–3 phút. Luôn xác nhận bằng `curl` chứ không chỉ bằng `docker ps`.

### 06.4 Xung đột cổng đã kiểm tra

| Cổng | Dịch vụ | Ghi chú |
|---|---|---|
| 3000 | Metabase | Xung đột với app khác trên host |
| 3001 | API | Không xung đột nội bộ stack |
| 4040 | Spark App UI | Chỉ có khi job đang chạy |
| 5173 | Web UI (nginx) | Vite đặt `strictPort: true` → bị chiếm là thoát |
| 5432 | *Không publish* | `lake-postgres` và `lake-airflow-db` chỉ trong mạng Docker |
| 5433 | Gold PostgreSQL | Không đụng Postgres cài sẵn trên host |
| 6379 | Redis | Có thể trùng Redis cài sẵn trên host |
| 8080 | Spark Master UI | **Airflow KHÔNG ở 8080** — Airflow ở 8088 |
| 8081 | Kafka UI | — |
| 8088 | Airflow Web | Ánh xạ `8088:8080` để tránh đụng Spark UI ở 8080 |
| 9000 / 9001 | MinIO API / Console | — |
| 9092 / 29092 | Kafka external / internal | Từ host dùng 9092; trong container dùng `kafka:29092` |
| 27017 | MongoDB | Có thể trùng Mongo cài sẵn |

### 06.5 An toàn tài nguyên Docker

**Sự kiện đã quan sát trên máy này:** `lake-spark-master`, `lake-spark-worker` và `lake-metabase` đều bị **OOM-killed** (`Exit 137`) khi Docker chỉ được cấp 7,75 GiB RAM. Spark master đã đăng ký worker thành công rồi mới bị giết; Metabase nhận `SIGTERM` sau khi hệ thống bắt đầu giảm tải. Ba container này là ứng viên đầu tiên bị giết khi RAM cạn.

Khuyến nghị:

- Docker Desktop → Settings → Resources: **Memory ≥ 10 GB**, CPUs 4–6.
- Build **tuần tự**: `export COMPOSE_PARALLEL_LIMIT=1`.
- Giữ nguyên ngân sách bộ nhớ trong Compose: `SPARK_DRIVER_MEMORY=768m`, `SPARK_EXECUTOR_MEMORY=768m`, `SPARK_MASTER=local[2]`, `MAX_ACTIVE_TASKS_PER_DAG=1`.
- `Dockerfile` API đã đặt `NEXT_BUILD_CPUS=2` — không nên tăng khi RAM thấp.
- Nếu không nâng được RAM: chạy `make up-api` (không bật `spark-master`/`spark-worker`/`metabase`), vì Control Plane không cần Spark cluster để đọc dữ liệu (DuckDB đọc trực tiếp).

Kiểm tra tài nguyên:

```bash
docker info --format '{{.MemTotal}} bytes, {{.NCPU}} cpus, {{.Architecture}}'
docker stats --no-stream
```

---

## 07. Cloudflare R2

### 07.1 Cảnh báo quan trọng về tên biến môi trường

Repo này có **ba bộ tên biến R2 khác nhau** ở ba nơi khác nhau. Bảng dưới là nguồn sự thật đã kiểm chứng bằng cách đọc mã nguồn:

| Bộ biến | Nơi dùng | Ai đọc | Trạng thái |
|---|---|---|---|
| `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION`, `S3_PATH_STYLE_ACCESS`, `S3_USE_SSL`, `S3_HEALTH_BUCKET` | `src/lakehouse/core/spark.py`, `src/lakehouse/ingest/batch/source_resolver.py`, `apps/api/src/config/env.ts` | **Spark (Python) và API (TypeScript)** | ✅ **Dùng bộ này** |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY`, `R2_SECRET_KEY` | `src/lakehouse/sync/r2_replicate.py` | Chỉ script replicate MinIO → R2 | ✅ Bộ riêng, không thay thế bộ trên |
| `R2_ENDPOINT_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Chỉ trong `.env.example` | **Không module nào đọc** | ⚠️ **Placeholder không dùng được** |

> ⚠️ **Nếu bạn chỉ điền `R2_ENDPOINT_URL` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` theo `.env.example` thì hệ thống vẫn dùng MinIO.** Bộ biến thật cho Spark và API là `S3_*`. Hãy điền `S3_*`.

`SOURCE VERIFIED` — đối chiếu `rg 'get_env\("' src/lakehouse` và `apps/api/src/config/env.ts`.

### 07.2 Cấu hình R2 (bộ biến thật)

```dotenv
# Bật R2: đặt S3_ENDPOINT và S3_*
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_ACCESS_KEY=<r2-access-key-id>
S3_SECRET_KEY=<r2-secret-access-key>
S3_REGION=auto
S3_USE_SSL=true
S3_PATH_STYLE_ACCESS=true
S3_HEALTH_BUCKET=bronze

# Vô hiệu hoá MinIO (comment hoặc xoá)
# MINIO_ENDPOINT=localhost:9000
# MINIO_ACCESS_KEY=minioadmin
# MINIO_SECRET_KEY=minioadmin
```

Cơ chế chuyển đổi trong `src/lakehouse/core/spark.py::_get_s3a_configs()`:

- `S3_ENDPOINT` có mặt → dùng S3A với endpoint R2, region `auto` (nếu `S3_REGION` không đặt), `use_ssl=true` nếu endpoint bắt đầu bằng `https://`.
- `S3_ENDPOINT` vắng → fallback `MINIO_ENDPOINT` (mặc định `localhost:9000`), region `us-east-1`.
- Đặt `S3_ENDPOINT` mà thiếu `S3_ACCESS_KEY`/`S3_SECRET_KEY` → ném `ValueError: S3_ACCESS_KEY and S3_SECRET_KEY are required when S3_ENDPOINT is set`.

API (`apps/api/src/config/env.ts`) làm tương tự: `S3_ENDPOINT` thắng `MINIO_ENDPOINT`, `S3_ACCESS_KEY` thắng `MINIO_ACCESS_KEY`, `S3_REGION` mặc định `auto` khi có `S3_ENDPOINT` nếu không đặt.

### 07.3 Bucket và prefix

| Bucket | Prefix | Nội dung |
|---|---|---|
| `lakehouse` | `bronze/`, `silver/`, `gold/` | **Bucket chuẩn của hệ thống** (không phải 3 bucket riêng) |
| `bronze` | `crm/`, `erp/`, `clickstream/`, `ecommerce/` | Bucket do `minio-init` tạo; layout **cũ**, code hiện tại không dùng |
| `silver` | như trên | Như trên |
| `gold` | như trên | Như trên |
| `scripts` | — | Bucket cho script, dùng bởi `r2_replicate` |

> ⚠️ **Khác biệt quan trọng.** `docs/operations/DATA_LAYOUT.md` mô tả layout `s3a://bronze/crm/customers/` (mỗi layer một bucket). Layout **thực tế** của code hiện tại là `s3a://lakehouse/bronze/crm/customers/` (một bucket, ba prefix). Tài liệu đó đã lỗi thời; README này và `src/lakehouse/core/paths.py` là nguồn đúng. `SOURCE VERIFIED` — runtime xác nhận `lakehouse/` có 780 object với prefix `bronze/`, `silver/`, `gold/`.

Bucket trên R2 phải tạo trước:

```bash
npx wrangler r2 bucket create lakehouse
npx wrangler r2 bucket list
```

### 07.4 Luồng dữ liệu R2

| Luồng | Mô tả | Cơ chế |
|---|---|---|
| **Ghi trực tiếp** | Spark ghi Delta thẳng lên R2 qua S3A | Khi `S3_ENDPOINT` được đặt, `build_spark_session()` nạp cấu hình S3A thay cho MinIO |
| **Đọc từ API** | API dùng DuckDB (`httpfs`) đọc Delta trên R2 | Cùng cơ chế S3A endpoint |
| **Replicate (script)** | Copy object MinIO → R2 | `python -m lakehouse.sync.r2_replicate` — dùng bộ biến `R2_ACCOUNT_ID`/`R2_ACCESS_KEY`/`R2_SECRET_KEY` |
| **Lifecycle** | Chuyển tier sau 30/90/365 ngày | `infra/r2/lifecycle-{bronze,silver,gold}.json` |

`r2_replicate` nhân bản 4 bucket: `bronze`, `silver`, `gold`, `scripts`. Nó theo dõi `last_sync.json` trong `/tmp/lakehouse-r2-sync` để chỉ copy object mới.

### 07.5 Kiểm chứng R2 an toàn (read-only)

```bash
# 1. Kiểm tra biến đã đúng tên (không in giá trị)
grep -E '^(S3_ENDPOINT|S3_ACCESS_KEY|S3_SECRET_KEY)=' .env | sed 's/=.*/=<set>/'

# 2. Liệt kê object (read-only)
npx wrangler r2 object list lakehouse --prefix bronze

# 3. Script kiểm tra chuyên dụng của repo
bash scripts/test_r2_connection.sh
```

`scripts/test_r2_connection.sh` in endpoint và 8 ký tự đầu access key — đó là hành vi **có sẵn trong repo**. Nếu bạn chia sẻ log, hãy che dòng đó.

> ⛔ **Không chạy `aws s3 sync` / `wrangler r2 object delete` chỉ để kiểm chứng README.** Các lệnh này ghi/xoá trên cloud và phát sinh chi phí. `DOCUMENTED BUT UNTESTED` — không có bucket R2 thật nào được đụng tới trong phiên audit này.

### 07.6 Quản lý chi phí

| Metric | Ngưỡng cảnh báo đề xuất |
|---|---|
| Storage used | 8 GB (80% free tier 10 GB) |
| Class A operations | 8 triệu/tháng |
| Class B operations | 8 triệu/tháng |
| Monthly cost | $1 |

Egress của R2 là **$0** — đây là lý do chính để chọn R2 thay vì S3 cho tầng cold.

### 07.7 Rollback về MinIO

```bash
sed -i '' 's/^S3_ENDPOINT=/#S3_ENDPOINT=/' .env
sed -i '' 's/^#MINIO_ENDPOINT=/MINIO_ENDPOINT=/' .env
make down && make up
```

Không cần đổi code: `core/spark.py` tự fallback sang `MINIO_ENDPOINT`.

---

## 08. Lưu trữ cục bộ & cơ sở dữ liệu

### 08.1 MinIO (storage backend mặc định)

| Thuộc tính | Giá trị |
|---|---|
| Image | `cgr.dev/chainguard/minio:latest` |
| Container | `lake-minio` |
| Cổng | API `9000`, Console `9001` |
| Credentials | `minioadmin` / `minioadmin` |
| Volume | `minio_data` → `/data` |
| Health check | TCP probe (image minimal không có `curl`/`wget`) |
| Lưu ý | Chạy `user: "0:0"` vì image Chainguard mặc định nonroot (uid 65532) không ghi được `/data` |

`minio-init` tạo bucket `bronze`, `silver`, `gold` và các prefix con `crm`, `erp`, `clickstream`, `ecommerce`.

> ⚠️ **`minio-init` KHÔNG tạo bucket `lakehouse`** — mà toàn bộ code ghi vào `s3a://lakehouse/...`. Xem mục 16.4, bước "Tạo bucket `lakehouse`". Đây là nguyên nhân phổ biến của lỗi `NoSuchBucket`.

### 08.2 MongoDB (metadata của Control Plane)

| Thuộc tính | Giá trị |
|---|---|
| Image | `mongo:7` |
| Container | `lake-mongo` |
| Cổng | `27017` |
| Credentials | `mongoadmin` / `mongoadmin` (`MONGO_INITDB_ROOT_USERNAME`/`_PASSWORD`) |
| Database | `lakehouse_catalog` (`MONGO_DB`) |
| Volume | `mongo_data` |
| Health check | `mongosh --eval 'db.runCommand({ping:1}).ok'` |

Lưu trữ: catalog, job history, DQ rule, EDA profile, audit log, user, crawler config.

> ⚠️ **Xác thực là bắt buộc.** Container Mongo bật `MONGO_INITDB_ROOT_USERNAME`/`_PASSWORD`. URI không kèm tài khoản sẽ *kết nối được* nhưng mọi lệnh bị từ chối với `Command aggregate requires authentication`. URI đúng từ host:
>
> ```dotenv
> MONGO_URI=mongodb://mongoadmin:mongoadmin@127.0.0.1:27017/?authSource=admin
> ```
>
> Trong Docker, Compose tự ghi đè thành `mongodb://mongoadmin:mongoadmin@mongo:27017/?authSource=admin`.

### 08.3 Redis (cache + hàng đợi BullMQ)

| Thuộc tính | Giá trị |
|---|---|
| Image | `redis:7-alpine` |
| Container | `lake-redis` |
| Cổng | `6379` |
| Auth | Không (mặc định local) |
| Volume | `redis_data`, `--appendonly yes` |
| Health check | `redis-cli ping` → `PONG` |

### 08.4 PostgreSQL — ba instance khác nhau

| Instance | Container | Image | DB | User | Cổng host | Mục đích |
|---|---|---|---|---|---|---|
| Metastore | `lake-postgres` | `postgres:13` | `hive_metastore` | `hive` | Không publish | Phụ thuộc của Spark session |
| Airflow DB | `lake-airflow-db` | `postgres:13` | `airflow` | `airflow` | Không publish | Metadata Airflow, `shm_size: 256mb` |
| Gold mirror | `lake-gold-postgres` | `postgres:16-alpine` | `gold_analytics` | `GOLD_POSTGRES_USER` (mặc định `metabase`) | **5433** | Bản sao Gold cho Metabase |

Không publish cổng cho metastore và Airflow DB là chủ ý — tránh đụng PostgreSQL cài sẵn trên máy và giảm bề mặt tấn công.

### 08.5 ZooKeeper + Kafka

| Thuộc tính | Giá trị |
|---|---|
| ZooKeeper | `confluentinc/cp-zookeeper:7.5.0`, cổng `2181`, volume `zookeeper_data_v2` / `zookeeper_log_v2` |
| Kafka | `confluentinc/cp-kafka:7.5.0`, cổng host `9092`, internal `29092` |
| Listener | `INTERNAL://kafka:29092`, `EXTERNAL://localhost:9092` |
| Replication | 1 broker, RF=1, 3 partition/topic, auto-create topic bật |
| Kafka UI | `provectuslabs/kafka-ui:latest`, cổng `8081` |

7 topic được `kafka-init` tạo: `clickstream-events`, `ecommerce-products-stream`, `ecommerce-reviews-stream`, `ecommerce-price-stream`, `crypto-prices-stream`, `github-trending-stream`, `hackernews-stream`. `RUNTIME VERIFIED` — đã liệt kê thực tế.

---

## 09. Lakehouse & kiến trúc Medallion

### 09.1 Định danh dataset chuẩn

`src/lakehouse/core/datasets.py` khai báo dataset là bộ bốn `(provider, layer, database, table)`:

| Provider | Đường dẫn | Ghi được? |
|---|---|---|
| `local_delta_minio` | `s3a://<bucket>/<layer>/<database>/<table>` | ✅ |
| `databricks_uc` | `<catalog>.<schema>.<table>` | ❌ read-only (`DATABRICKS_READ_ONLY`) |

Bảng ánh xạ bảng → database:

| Bảng | Database |
|---|---|
| `customers` | `crm` |
| `products` | `erp` |
| `orders` | `erp` |
| `events`, `unique_metrics_5min` | `clickstream` |
| `crawler_records`, `crawler_records_delta`, `crawler_source_metrics_delta` | `crawler` |
| `fact_orders`, `dim_customers`, `dim_products`, `daily_revenue` | `retail` |

Nguồn Silver của từng bảng Gold:

| Bảng Gold | Nguồn Silver |
|---|---|
| `fact_orders` | `orders`, `customers`, `products` |
| `dim_customers` | `customers`, `orders` |
| `dim_products` | `products`, `orders` |
| `daily_revenue` | `orders` |

Khóa tự nhiên (dùng để MERGE nên ingestion idempotent): `customers`→`customer_id`, `products`→`product_id`, `orders`→`order_id`, `events`→`event_id`.

### 09.2 Bronze

| Thuộc tính | Giá trị |
|---|---|
| Nguồn | `data-samples/crm/customers.csv`, `data-samples/erp/products.csv`, `data-samples/erp/orders.json`, Kafka topic, crawler |
| Job | `lakehouse.ingest.batch.csv_ingestor`, `json_ingestor`, `ingest.streaming.*` |
| Đường dẫn | `s3a://lakehouse/bronze/{database}/{table}` |
| Format | Delta Lake, Parquet + snappy |
| Partition | `processing_date` (`DEFAULT_PARTITION_BY`) |
| Ghi | MERGE theo khóa tự nhiên → chạy lại không nhân bản |
| Streaming checkpoint | `s3a://lakehouse/bronze/_checkpoints/{ns}/{topic}/` |

`RUNTIME VERIFIED` — bucket `lakehouse` chứa `bronze/crm/customers/` với `_delta_log/` và file `.snappy.parquet`, cùng 4 nhóm checkpoint (`clickstream/events`, `ecommerce/{prices,products,reviews}`).

### 09.3 Silver

| Thuộc tính | Giá trị |
|---|---|
| Job | `lakehouse.transform.batch.{customers,products,orders}_transformer` |
| Đường dẫn | `s3a://lakehouse/silver/{database}/{table}` |
| Nội dung | Làm sạch, ép kiểu, khử trùng lặp, làm giàu |

### 09.4 Gold

| Thuộc tính | Giá trị |
|---|---|
| Job | `lakehouse.aggregate.batch.{fact_orders,dim_customers,dim_products,daily_revenue}_aggregator` |
| Đường dẫn | `s3a://lakehouse/gold/retail/{table}` |
| Streaming | `aggregate.streaming.{category_revenue,clickstream_metrics,ecommerce_metrics}_aggregator` |
| Mirror BI | `scripts/sync_gold_to_metabase.sh` → `gold_analytics.public.*` |

`RUNTIME VERIFIED` — 4 bảng `fact_orders`, `daily_revenue`, `dim_customers`, `dim_products` tồn tại trong `gold_analytics.public`.

### 09.5 Định dạng lưu trữ

| Hạng mục | Giá trị |
|---|---|
| Định dạng bảng | Delta Lake 3.0.0 |
| File data | Parquet + snappy |
| Transaction log | `_delta_log/*.json` |
| Schema evolution | `spark.databricks.delta.schema.autoMerge.enabled=true` |
| S3A path style | `true` (R2 chỉ hỗ trợ path-style) |
| Credentials provider | `SimpleAWSCredentialsProvider` |
| Region | `auto` khi dùng R2, `us-east-1` khi dùng MinIO |

---

## 10. Pipeline batch & streaming

### 10.1 Registry pipeline

| Pipeline | Entry point | Input | Biến đổi | Output | Phụ thuộc | Lệnh |
|---|---|---|---|---|---|---|
| Batch retail (9 stage) | `lakehouse.pipelines.batch_retail` | `data-samples/**` | ingest CSV + JSON → 3 transform → 4 aggregate | `s3a://lakehouse/{bronze,silver,gold}/` | `lake-spark-master` healthy, bucket `lakehouse` | `make pipeline-batch` |
| Bronze CSV | `lakehouse.ingest.batch.csv_ingestor` | `data-samples/crm\|erp/*.csv` | Nạp, partition theo ngày | `bronze/{crm,erp}/` | ↑ | `make pipeline-bronze` |
| Silver customers | `lakehouse.transform.batch.customers_transformer` | `bronze/crm/customers` | Làm sạch, ép kiểu | `silver/crm/customers` | ↑ | `make pipeline-silver` |
| Gold fact_orders | `lakehouse.aggregate.batch.fact_orders_aggregator` | `silver/erp/orders` + `silver/crm/customers` + `silver/erp/products` | Tổng hợp | `gold/retail/fact_orders` | ↑ | `make pipeline-gold` |
| Clickstream streaming | `lakehouse.pipelines.stream_clickstream` | Kafka `clickstream-events` | Structured Streaming → Delta | `bronze/clickstream/events` + Silver/Gold | Kafka healthy, `lake-spark-master` | `make stream-clickstream` |
| Ecommerce streaming | `lakehouse.pipelines.stream_ecommerce` | Kafka `ecommerce-*-stream` | Structured Streaming → Delta | `bronze/ecommerce/*` | ↑ | `make stream-ecommerce` |
| Clickstream unique metrics | `lakehouse.aggregate.batch.clickstream_unique_metrics_aggregator` | Bronze clickstream | Tính lại chỉ số unique theo lô | `silver/clickstream/unique_metrics_5min` | ↑ | `make aggregate-clickstream-unique` |
| Crawler → Delta | `lakehouse.tools.crawler_minio_etl` | Crawler output | Ghi Delta | `bronze/crawler/*` | `lake-spark-master` | `bash scripts/run_crawl_scheduler.sh` |
| Gold → PostgreSQL | `scripts/sync_gold_to_metabase.sh` | Gold Delta | `spark-submit` + JDBC | `gold_analytics.public.*` | Gold có dữ liệu | `bash scripts/sync_gold_to_metabase.sh` |
| Job từ Control Plane | `lakehouse.jobs.runner` | JSON payload | Dispatch theo allowlist operation | Delta | `lake-worker` | Worker tự gọi |
| R2 replicate | `lakehouse.sync.r2_replicate` | MinIO objects | Copy sang R2 | R2 buckets | R2 credentials | `python -m lakehouse.sync.r2_replicate` |

### 10.2 Batch retail — 9 stage

```text
bronze.ingest_csv          → bronze/crm/customers, bronze/erp/products
bronze.ingest_json         → bronze/erp/orders
silver.transform_customers → silver/crm/customers
silver.transform_products  → silver/erp/products
silver.transform_orders    → silver/erp/orders
gold.aggregate_fact_orders      → gold/retail/fact_orders
gold.aggregate_dim_customers    → gold/retail/dim_customers
gold.aggregate_dim_products     → gold/retail/dim_products
gold.aggregate_daily_revenue    → gold/retail/daily_revenue
```

Nguồn: `src/lakehouse/pipelines/batch_retail.py` (`SOURCE VERIFIED`).

### 10.3 Dữ liệu mock

```bash
make mock-retail
# hoặc không cần cài gói:
PYTHONPATH=src python3 -m lakehouse.sources.mock.retail_generator
```

Kết quả mặc định — **200 khách hàng, 50 sản phẩm, 1000 đơn hàng**:

```text
data-samples/crm/customers.csv
data-samples/erp/products.csv
data-samples/erp/orders.json
```

`data-samples/` bị `.gitignore` — mỗi máy tự sinh. Có thể đổi thư mục đầu ra bằng `DATA_SAMPLES_DIR`.

### 10.4 Streaming

```bash
make produce-clickstream                              # 100 sự kiện, 10 msg/s
bash scripts/produce_kafka.sh clickstream-events 500 20
bash scripts/produce_kafka.sh ecommerce-products-stream 50 5

make stream-clickstream
make stream-ecommerce
make aggregate-clickstream-unique
```

`scripts/produce_kafka.sh` dùng `.venv/bin/python` + `kafka-python` ⇒ cần mục 14.2. Từ host, `KAFKA_BOOTSTRAP=localhost:9092`.

### 10.5 Crawler

```bash
make crawl-tiki       # Tiki, danh mục smartphone, 5 trang
make crawl-all        # GitHub trending, Crypto, HackerNews
make scheduler-list   # liệt kê job
make scheduler-once NAME=tiki-smartphone
make scheduler-daemon # nền, log /tmp/crawl_scheduler.log
make scheduler-stop
```

Scheduler có **8 job** (`build_default_scheduler()`):

| Job | Chu kỳ | Nguồn |
|---|---|---|
| `tiki-smartphone`, `tiki-laptop`, `tiki-fashion`, `tiki-beauty`, `tiki-home-appliance` | 6 giờ | Tiki.vn |
| `github-trending` | 1 giờ | GitHub trending |
| `hackernews-top` | 30 phút | HackerNews |
| `crypto-top-50` | 5 phút | CoinGecko |

> Dòng chú thích trong `Makefile` (`# Run crawl scheduler (foreground, all 11 jobs)`) là **cũ**. Số job thực tế là 8. `SOURCE VERIFIED`

Crawler tạo `KafkaProducer` khi khởi tạo ⇒ **cần Kafka truy cập được**, nếu không sẽ báo `NoBrokersAvailable`.

### 10.6 Airflow DAG

| DAG ID | Lịch | Việc |
|---|---|---|
| `retail_elt_dag` | `None` (chạy tay) | `health_check` → 3 task Bronze → 3 task Silver → 4 task Gold. `max_active_tasks=1` |
| `crawler_dag` | Mỗi giờ | Crawler → Delta qua `lake-spark-master` |
| `clickstream_streaming_dag` | Mỗi giờ | `spark-submit` pipeline clickstream |
| `ecommerce_streaming_dag` | Mỗi giờ | `spark-submit` pipeline ecommerce |

Đồ thị phụ thuộc `retail_elt_dag`:

```text
health_check >> [bronze_ingest_customers, bronze_ingest_products, bronze_ingest_json]
bronze_ingest_customers >> silver_customers >> gold_dim_customers
bronze_ingest_products  >> silver_products  >> gold_dim_products
bronze_ingest_json      >> silver_orders    >> gold_daily_revenue
[silver_customers, silver_products, silver_orders] >> gold_fact_orders
```

Cấu hình Airflow: `LocalExecutor`, `AIRFLOW__CORE__MAX_ACTIVE_TASKS_PER_DAG=1`, `SPARK_DRIVER_MEMORY=768m`, `SPARK_MASTER=local[2]`, mount `/var/run/docker.sock` để task gọi `docker exec lake-spark-master spark-submit`.

> **RUNTIME VERIFIED** — cả 4 DAG đều ở trạng thái `paused=False` và `airflow dags list-import-errors` trả `No data found`. (README cũ nói chỉ `retail_elt_dag` được bật — đã cập nhật theo runtime thực tế.)

### 10.7 Job bất đồng bộ (allowlist)

`src/lakehouse/jobs/protocol.py` chỉ cho phép 6 operation:

| Operation | Ý nghĩa |
|---|---|
| `bronze_ingest_csv` | Nạp CSV vào Bronze |
| `bronze_ingest_json` | Nạp JSON vào Bronze |
| `bronze_ingest_stream` | Nạp từ Kafka topic |
| `silver_transform` | Chạy transformer Silver |
| `gold_aggregate` | Chạy aggregator Gold |

Gọi trực tiếp:

```bash
python -m lakehouse.jobs.runner '{"operation": "bronze_ingest_csv", "params": {...}}'
```

Response là **một dòng JSON** trên stdout; log nằm trên stderr (để stdout luôn parse được).

---

## 11. Backend & API

### 11.1 Framework và entrypoint

| Thuộc tính | Giá trị |
|---|---|
| Framework | Next.js 15 (App Router), TypeScript 5.5 |
| Entry point | `apps/api/src/middleware.ts` → `apps/api/src/app/api/**/route.ts` |
| Server | `next start -p 3001` (production), `next dev -p 3001` (dev) |
| Port | `3001` |
| Validation | Zod (`apps/api/src/config/env.ts` — validate lúc load module) |
| Logging | pino + pino-pretty |
| Auth | JWT tự implement (`apps/api/src/modules/security`) |
| Docs | `next-swagger-doc` + `swagger-ui-react` → `/api-doc` |

> **Vì sao base image là `node:20-bookworm-slim` chứ không phải Alpine?** DuckDB tải extension theo platform nó phát hiện. Trên Alpine, platform là `linux_arm64_musl` và repository extension của DuckDB **không có** bản build cho platform đó (HTTP 404). Base glibc báo `linux_arm64` — có bản build. Vì vậy `next build` hay API trên Alpine sẽ lỗi `Failed to download extension "delta"`. `SOURCE VERIFIED` — `apps/api/Dockerfile`

### 11.2 Ma trận route (131 route handler)

| Nhóm | Chức năng |
|---|---|
| `/api/health`, `/api/health/deep`, `/api/info` | Sức khỏe nhanh / sâu, thông tin ứng dụng |
| `/api/dashboard/*` | `summary`, `activity`, `dependencies` cho màn hình Home |
| `/api/catalog/*` | `databases`, `tables`, `schemas`, `search`, `lineage`, `sample`, `stats`, `sync` |
| `/api/bronze/*` | `ingest/csv`, `ingest/json`, `ingest/stream/{topic}`; bảng, `partitions`, `history`, `vacuum`, `jobs` |
| `/api/silver/*` | `transform/{table}`, `transform/all`, `refresh`, `history`, `time-travel/{version}`, `diff/{v1}/{v2}`, `jobs` |
| `/api/gold/*` | `aggregate/{table}`, `aggregate/all`, `refresh`, `queries/{business-metrics,category-revenue,customer-analytics,product-performance,ad-hoc}`, `lineage`, `jobs` |
| `/api/crawler/*` | danh sách, `config`, `preview`, `run`, `run-async`, `stop`, `runs`, `kafka-topic`, `stats` |
| `/api/kafka/*` | `cluster`, `stats`, `topics`, `produce`, `produce-batch`, `messages`, `consumer-groups`, `lag`, `reset-offset` |
| `/api/airflow/*` | `health`, `stats`, `dags`, `pause`/`unpause`, `trigger`, `runs`, `tasks`, `gantt`, `preflight`, `conf-spec` |
| `/api/dq/*` | `rules`, `presets`, `run-suite`, `runs`, `summary` |
| `/api/eda/*` | `profiles`, `columns`, `charts`, `sample`, `compare`, `propose-rule` |
| `/api/operations/*` | danh sách, chi tiết, `events`, `cancel`, `retry` |
| `/api/auth/login`, `/api/auth/confirm`, `/api/users`, `/api/audit` | Đăng nhập, token xác nhận, quản lý user, nhật ký kiểm toán |

Truy vấn Gold nghiệp vụ dùng SQL file trong `apps/api/src/modules/gold-queries/sql/`:

```text
01_business_metrics.sql
02_customer_analytics.sql
03_product_performance.sql
04_category_revenue.sql
```

> ⚠️ **Cần `COPY` thư mục SQL vào image.** Runtime image không có `src/`. Nếu thiếu, API trả `500 ENOENT /app/src/modules/gold-queries/sql/01_business_metrics.sql`. Dòng cần có trong `apps/api/Dockerfile`:
>
> ```dockerfile
> COPY --from=builder /app/src/modules/gold-queries/sql ./src/modules/gold-queries/sql
> ```
>
> `SOURCE VERIFIED` — dòng này đã được commit trong `cd93c8c`.

### 11.3 Xác thực và phân quyền

| Thuộc tính | Giá trị |
|---|---|
| Bật/tắt | `API_AUTH_ENABLED` (mặc định `false`) |
| Token | `API_JWT_SECRET` (≥ 32 ký tự), HMAC |
| TTL session | `API_SESSION_TTL_SECONDS` (mặc định `3600`, tối thiểu 60) |
| TTL confirm | `API_CONFIRM_TOKEN_TTL_SECONDS` (mặc định `120`, tối thiểu 10) |
| Khóa dịch vụ | `API_SERVICE_KEYS` — JSON: `keyId`, `secretHash` (SHA-256 hex), `principalId`, `role`, `scopes` |
| Người dùng | `API_USER_CREDENTIALS` — JSON: `principalId`, `secretHash`, `role`, `scopes` |
| Audit | `API_AUDIT_ENABLED` (mặc định `true`) |
| Rate limit | `API_RATE_LIMIT_PER_MIN` (mặc định `600`) |
| Fail-open | `API_RATE_LIMIT_FAIL_OPEN` (mặc định `true`) |
| CORS | `API_CORS_ORIGINS` — CSV, mặc định `http://localhost:3000` |

Bốn vai trò: `viewer` (chỉ đọc) → `analyst` (thêm EDA, DQ, xem mẫu) → `operator` (thêm chạy pipeline, nạp dữ liệu, ghi Kafka) → `admin` (toàn quyền).

Policy engine: `apps/api/src/modules/security/services/policy.service.ts` — ánh xạ (HTTP method, regex path) → scope. 60+ rule cho `dataset:read`, `dataset:sample`, `ingestion:run`, `pipeline:run`, `kafka:produce`, `airflow:trigger`, `crawler:run`, `dq:rule:manage`, `catalog:sync`, `partition:delete`, `retention:vacuum`, `job:cancel`, `user:manage`, `audit:read`, `system:read`…

Route công khai (không cần credential): `/api/health`, `/api/health/deep`, `/api/info`, `/api/docs`, `/api/doc`, `/api/api-doc`, `/api/auth/login`.

> ⚠️ **Root path cần regex có `(?:\/|$)`.** Nếu rule là `/^\/api\/bronze\//` thì `GET /api/bronze` (không có dấu `/` cuối) không khớp → `403 UNKNOWN_ROUTE`. Sửa đúng:
>
> ```typescript
> rule('GET', /^\/api\/bronze(?:\/|$)/, READ),
> rule('GET', /^\/api\/silver(?:\/|$)/, READ),
> rule('GET', /^\/api\/gold(?:\/|$)/, READ),
> ```
>
> `SOURCE VERIFIED` — thay đổi này đã được commit trong `cd93c8c`.

### 11.4 Worker

`apps/api/src/workers/main.ts` — consumer BullMQ cho **4 hàng đợi**: `bronze`, `silver`, `gold`, `crawler`, cộng `OperationsWorker` (reconciler + heartbeat).

Image worker (`apps/api/Dockerfile.worker`) là `FROM lake-airflow:2.7.0` — dùng lại đúng stack Python + JDK 17 + Spark đã kiểm chứng, nên worker và Airflow chạy **cùng phiên bản dependency**. Node binary được copy từ `node:20-bookworm-slim` để khớp base Debian/glibc.

> ⚠️ **Không có worker thì job nằm mãi ở `queued`.** API chỉ *nộp* job; worker mới *chạy*. Kiểm tra: `docker logs --tail 50 lake-worker` và `docker exec lake-redis redis-cli ping`.

### 11.5 Bộ nạp biến môi trường chung

Một grammar, hai runtime:

- TypeScript: `apps/api/env-loader.js` (CommonJS, chạy trong Next.js).
- Python: `src/lakehouse/core/env.py`.

Chế độ sở hữu (`file` vs `ambient`) giống nhau:

1. `LAKEHOUSE_ENV_PRECEDENCE=file|ambient` — lựa chọn của operator.
2. Trong container (`/.dockerenv` tồn tại) → `ambient`.
3. `ENV=staging|prod` → `ambient`.
4. Còn lại → `file` (máy dev và test).

`NODE_ENV` **không** tham gia quyết định — Next.js set `NODE_ENV=production` lúc build, nếu dựa vào nó thì local build sẽ mất credential trong `.env.local`.

`tests/test_env_parity.py` (242 dòng, thêm trong `dev-v4`) khẳng định hai bên cho kết quả giống nhau key-for-key trên bộ corpus khó.

### 11.6 Health check

| Endpoint | Nội dung |
|---|---|
| `GET /api/health` | Nhanh. Trả `{"data":{"status":"ok", ...}}`. Các dependency ở trạng thái `skipped` với `mode: deep-only` |
| `GET /api/health/deep` | Sâu. Probe từng dependency và trả latency |

Kết quả quan sát được trên máy này:

```text
MongoDB   up   14 ms    connectionState: 1
Redis     up   31 ms    ping: PONG
DuckDB    up   156 ms   selectOk: true
MinIO     up   168 ms   bucket: bronze
Kafka     up   23 ms    topics: 7
Airflow   up   206 ms   scheduler healthy, metadatabase healthy
Databricks up  2173 ms  warehouseState: RUNNING
```

---

## 12. Frontend & dashboard

### 12.1 Framework

| Thuộc tính | Giá trị |
|---|---|
| Framework | React 19 + Vite 5 |
| Ngôn ngữ | TypeScript 5.5 |
| Style | Tailwind CSS 3 + PostCSS + Autoprefixer |
| State | Zustand (`auth`, `theme`), TanStack Query 5 |
| Định tuyến | react-router-dom 6 (`BrowserRouter`) |
| i18n | i18next + react-i18next, locale `en` / `vi` |
| 3D | three.js + @react-three/fiber (màn hình Schematic) |
| Port dev | `5173` (`strictPort: true`, `host: true`) |
| Build | `vite build` → `apps/web/dist` |
| Serve production | nginx 1.27-alpine, `apps/web/nginx.conf` |

### 12.2 Route và màn hình

Khai báo tại `apps/web/src/navigation/routes.ts` và `apps/web/src/App.tsx`. 12 route được render:

| Đường dẫn | Màn hình | Mục đích |
|---|---|---|
| `/` | Home | Tổng quan hệ thống, hoạt động gần đây, phụ thuộc giữa các thành phần |
| `/catalog` | Catalog | Duyệt database/bảng, schema, mẫu, thống kê, lineage, tìm kiếm, đồng bộ metadata |
| `/bronze` | Bronze | Nạp CSV/JSON/Kafka, xem bảng, partition, lịch sử Delta, vacuum, theo dõi job |
| `/silver` | Silver | Transform, xem bảng, lịch sử, time travel, diff hai phiên bản |
| `/gold` | Gold | Aggregate, xem bảng, truy vấn nghiệp vụ dựng sẵn và ad-hoc |
| `/crawler` | Crawler | Điều khiển `tiki`, `github`, `crypto`, `hackernews` |
| `/kafka` | Kafka | Cluster, topic, consumer group, đọc/ghi message |
| `/airflow` | Airflow | DAG, bật/tắt, trigger, run, task, biểu đồ Gantt |
| `/dq` | Data Quality | Rule, preset, bộ kiểm tra, tổng hợp kết quả |
| `/eda` | EDA | Profile, thống kê cột, biểu đồ, so sánh, đề xuất rule DQ |
| `/health` | Health | Trạng thái dịch vụ, kiểm tra nhanh/sâu |
| `/schematic` | Schematic | Sơ đồ kiến trúc tương tác (Three.js) |

Route lạ → chuyển hướng `/`. `ROUTES.SETTINGS` (`/settings`) có trong hằng số nhưng **không** được render trong `App.tsx`.

> **Thay đổi trong `7b63257`:** `App.tsx` gate toàn bộ route sau `useAuthStore.isAuthenticated`; khi chưa đăng nhập thì hiển thị `LoginView` (file mới `apps/web/src/screens/login.view.tsx`). Trước thay đổi này, UI không có màn hình đăng nhập — đó là lý do luồng auth chưa hoạt động end-to-end trước đây.

### 12.3 Tích hợp API

| Môi trường | Cơ chế |
|---|---|
| **Dev trên host** | `VITE_API_BASE_URL` để trống → trình duyệt gọi cùng origin `/api/...`; Vite proxy `/api` → `API_PROXY_TARGET` (mặc định `http://127.0.0.1:3001`) |
| **Docker (web + api)** | nginx trong `apps/web/nginx.conf` proxy `location /api/` → `http://api:3001` |
| **Cloudflare Pages** | `VITE_API_BASE_URL` được **nhúng lúc build** → phải trỏ tới hostname tunnel |

> ⚠️ **Không đặt `VITE_API_BASE_URL=http://api:3001`.** Tên service `api` chỉ có ý nghĩa trong mạng Docker; trình duyệt của người dùng không phân giải được hostname đó. Chỉ dùng URL tuyệt đối (public/tunnel) hoặc để trống để dùng same-origin. `SOURCE VERIFIED` — `apps/web/nginx.conf`, `apps/web/vite.config.ts`, `apps/web/Dockerfile`

### 12.4 Lệnh phát triển

```bash
# Toàn bộ workspace: API + worker + Web song song
pnpm dev

# Chỉ API
pnpm --filter lakehouse-api dev:api      # next dev -p 3001

# Chỉ Web
pnpm --filter @lakehouse/web dev         # vite, strictPort 5173

# Build + test
pnpm --filter @lakehouse/web build
pnpm --filter @lakehouse/web test
pnpm --filter @lakehouse/web typecheck
pnpm --filter @lakehouse/web test:e2e    # Playwright
```

> ⚠️ `scripts/dev-api.sh` và `scripts/dev-web.sh` **không dùng được**: chúng tính `REPO_ROOT="$SCRIPT_DIR/../.."` — từ `scripts/` đi hai cấp sẽ ra ngoài repo, nên `cd "$REPO_ROOT/apps/api"` trỏ sai. Dùng `pnpm --filter …` như trên. `SOURCE VERIFIED`

---

## 13. Yêu cầu trước khi bắt đầu

### 13.1 Phần mềm

| Công cụ | Phiên bản | Dùng để | Bắt buộc? |
|---|---|---|---|
| Git | bất kỳ bản mới | Lấy mã nguồn | ✅ |
| Docker Desktop + Compose v2 | Docker 24+, lệnh `docker compose` (có dấu cách) | Toàn bộ hạ tầng | ✅ |
| Node.js | ≥ 20 (CI dùng 20) | Chạy API/Web ở chế độ dev, chạy test | Nếu chạy dev/test Node |
| pnpm | ≥ 9 (đã kiểm tra 9.15.9) | Workspace `apps/*` | Nếu dùng Node |
| Python | ≥ 3.10 (CI dùng 3.12) | Generator, crawler scheduler, pytest, lint | Nếu chạy Python trên host |
| GNU Make | bất kỳ | `make up`, `make help` | Khuyến nghị |
| Bash, curl, openssl | — | Script `scripts/`, sinh khóa Fernet | ✅ |
| Java JDK | 17 | Chỉ khi chạy Spark **trên host** (`make demo`, `make spark-shell`) | ❌ (Docker đã có JDK) |

> **Để chạy stack bằng Docker, host KHÔNG cần Java, Spark hay Python.** Spark, Airflow và worker đều mang JDK 17 trong image. Máy tham chiếu không cài Java mà stack vẫn chạy bình thường.

Repo dùng script Bash và đường dẫn kiểu Unix ⇒ **Windows phải dùng WSL2**.

### 13.2 Tài nguyên

| Thành phần | Tối thiểu | Khuyến nghị |
|---|---|---|
| RAM cho Docker | 8 GB | 12 GB trở lên |
| CPU cho Docker | 4 nhân | 6 nhân trở lên |
| Ổ đĩa trống | 25 GB | 40 GB trở lên |
| Mạng | Internet ở lần build đầu | Tải image, JAR từ Maven Central, JDK từ GitHub |

Con số RAM là khuyến nghị rút từ cấu hình repo và sự cố đã gặp (OOM ở mục 06.5), không phải kết quả đo cho từng cấu hình máy.

### 13.3 Cài đặt theo hệ điều hành

<details>
<summary><b>macOS (Apple Silicon M1/M2/M3/M4 và Intel)</b></summary>

```bash
# 1. Công cụ dòng lệnh Xcode (git, make)
xcode-select --install

# 2. Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"      # Intel: /usr/local/bin/brew

# 3. Docker Desktop
brew install --cask docker
open -a Docker
```

Sau khi Docker Desktop mở: **Settings → Resources** → Memory **≥ 10 GB**, CPUs 4–6, Disk image ≥ 64 GB → **Apply & restart**.

```bash
# 4. Node.js 20 + pnpm 9
brew install node@20
echo 'export PATH="/opt/homebrew/opt/node@20/bin:$PATH"' >> ~/.zshrc   # Intel: /usr/local/opt/node@20/bin
source ~/.zshrc
corepack enable
corepack prepare pnpm@9.15.9 --activate

# 5. Python 3.12 + Make (macOS đã có GNU Make 3.81 qua Xcode CLT)
brew install python@3.12
python3.12 --version

# 6. (Tùy chọn) Java 17 — chỉ khi chạy Spark trên host
brew install --cask temurin@17
/usr/libexec/java_home -v 17
echo 'export JAVA_HOME=$(/usr/libexec/java_home -v 17)' >> ~/.zshrc
```

> **Kiến trúc CPU:** `Dockerfile.airflow` tải JDK `aarch64` — đúng cho Apple Silicon. Mac Intel phải làm bước đổi JDK ở mục 13.4.

</details>

<details>
<summary><b>Linux (Ubuntu 22.04/24.04 và Debian 12)</b></summary>

```bash
# 1. Gói cơ bản
sudo apt-get update
sudo apt-get install -y git make curl ca-certificates gnupg openssl build-essential \
  python3 python3-venv python3-pip

# 2. Docker Engine + Compose v2
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
newgrp docker            # hoặc đăng xuất rồi đăng nhập lại
docker run --rm hello-world
docker compose version
```

Với Debian, thay `ubuntu` trong URL bằng `debian`.

```bash
# 3. Node.js 20 + pnpm 9 qua nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20 && nvm use 20
corepack enable
corepack prepare pnpm@9.15.9 --activate

# 4. (Tùy chọn) Java 17 — chỉ khi chạy Spark trên host
sudo apt-get install -y openjdk-17-jre-headless
java -version
```

> ⚠️ **Quyền Docker socket cho Airflow trên Linux native.** Các DAG chạy `docker exec lake-spark-master spark-submit …` nên container Airflow mount `/var/run/docker.sock`. Trên Linux native socket thuộc `root:docker` với `srw-rw----`, còn user `airflow` (uid 50000) **không có quyền ghi** ⇒ task lỗi `permission denied`. (Docker Desktop trên macOS/Windows mở rộng quyền nên không gặp lỗi này.)
>
> Cách khuyến nghị — tạo `docker-compose.linux.yml`:
>
> ```yaml
> services:
>   airflow-webserver:
>     group_add:
>       - "${DOCKER_GID}"
>   airflow-scheduler:
>     group_add:
>       - "${DOCKER_GID}"
> ```
>
> ```bash
> export DOCKER_GID=$(getent group docker | cut -d: -f3)
> docker compose -f docker-compose.yml -f docker-compose-kafka.yml -f docker-compose.linux.yml up -d
> ```
>
> Cách nhanh cho máy cá nhân (một lần): `sudo chmod 666 /var/run/docker.sock` — cho mọi user quyền điều khiển Docker (tương đương root), và bị đặt lại khi Docker khởi động lại.
>
> `DOCUMENTED BUT UNTESTED` — không có máy Linux để kiểm chứng trực tiếp.

</details>

<details>
<summary><b>Windows 10/11 (WSL2 + Docker Desktop)</b></summary>

Cách ổn định nhất: chạy **mọi thứ bên trong WSL2 (Ubuntu)** với Docker Desktop dùng backend WSL2. **Không** clone repo vào `C:\` rồi chạy từ PowerShell.

Yêu cầu: Windows 10 build 2004+ (19041+) hoặc Windows 11, bật ảo hóa trong BIOS/UEKI.

```powershell
# PowerShell (Administrator)
wsl --install -d Ubuntu-24.04
```

Khởi động lại máy nếu được yêu cầu, mở "Ubuntu" từ Start Menu, tạo user. Kiểm tra:

```powershell
wsl -l -v          # cột VERSION phải là 2
```

Docker Desktop: **Settings → General → Use the WSL 2 based engine**; **Resources → WSL Integration** bật cho distro. **Apply & restart**.

Giới hạn tài nguyên WSL2 — tạo `%UserProfile%\.wslconfig`:

```ini
[wsl2]
memory=10GB
processors=6
swap=4GB
```

```powershell
wsl --shutdown
```

Trong Ubuntu, làm đúng như mục Linux ở trên **trừ bước cài Docker Engine** (Docker Desktop đã cấp lệnh `docker`):

```bash
sudo apt-get update
sudo apt-get install -y git make curl ca-certificates openssl build-essential python3 python3-venv python3-pip
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20 && nvm use 20
corepack enable
corepack prepare pnpm@9.15.9 --activate
docker version
docker compose version
```

Chặn lỗi CRLF — repo **không có** `.gitattributes`. Cấu hình Git **bên trong WSL** trước khi clone:

```bash
git config --global core.autocrlf input
```

Clone vào hệ file WSL, không vào `/mnt/c/...` (hệ file Windows qua `/mnt/c` rất chậm với `pnpm install` và `next build`):

```bash
mkdir -p ~/projects && cd ~/projects
```

Sau đó tiếp tục mục 14. Có thể mở bằng `code .` (extension "WSL") hoặc `\\wsl$\Ubuntu-24.04\home\<user>\projects`.

Các cổng (`localhost:5173`, `3001`, `8088`…) được Docker Desktop và WSL2 chuyển tiếp về `localhost` của Windows nên trình duyệt Windows dùng bình thường.

Lưu ý riêng cho Windows:
- Chạy mọi lệnh `make`, `bash scripts/...`, `docker compose`, `pnpm` **trong terminal Ubuntu**, không phải PowerShell.
- Windows ARM (Surface Pro X, Copilot+ PC) dùng JDK `aarch64` như mặc định. Windows x64 phải đổi JDK sang `x64` (mục 13.4).

</details>

<details>
<summary><b>Chỉ Mac Intel, Windows x64, Linux x64/amd64: đổi JDK trong <code>Dockerfile.airflow</code></b></summary>

`Dockerfile.airflow` tải JDK Temurin 17 bản **`aarch64`** (có SHA-256 cố định) để hợp với Apple Silicon và ARM. Trên x86_64, tệp thực thi `java` của bản `aarch64` không chạy được ⇒ image Airflow (và cả worker, vì worker dựa trên nó) hỏng khi chạy Spark.

Linux và WSL (GNU sed):

```bash
sed -i \
  -e 's/jdk_aarch64_linux_hotspot/jdk_x64_linux_hotspot/' \
  -e 's/6e4201abfb3b020c1fb899b7ac063083c271250bf081f3aa7e63d91291a90b74/a8fd07e1e97352e97e330beb20f1c6b351ba064ca7878e974c7d68b8a5c1b378/' \
  Dockerfile.airflow
```

macOS Intel (BSD sed cần `-i ''`):

```bash
sed -i '' \
  -e 's/jdk_aarch64_linux_hotspot/jdk_x64_linux_hotspot/' \
  -e 's/6e4201abfb3b020c1fb899b7ac063083c271250bf081f3aa7e63d91291a90b74/a8fd07e1e97352e97e330beb20f1c6b351ba064ca7878e974c7d68b8a5c1b378/' \
  Dockerfile.airflow
```

Hai giá trị là tên file JDK và SHA-256 tương ứng (`a8fd07e1…` là checksum chính thức của `OpenJDK17U-jdk_x64_linux_hotspot_17.0.10_7.tar.gz` từ Adoptium). Kiểm tra lại:

```bash
grep -nE "aarch64|x64_linux|JAVA_SHA256" Dockerfile.airflow
```

Sau lệnh này `Dockerfile.airflow` sẽ hiện là file đã sửa trong `git status` — đây là thay đổi cục bộ, không nên commit nếu cả nhóm dùng ARM.

`DOCUMENTED BUT UNTESTED` — chỉ đối chiếu checksum, chưa build trên máy x86_64.

</details>

### 13.4 Kiểm tra công cụ đã đủ

```bash
git --version
docker --version
docker compose version
make --version | head -1
node -v            # phải là v20 trở lên
pnpm -v            # phải là 9 trở lên
python3 --version  # 3.10 trở lên
openssl version
docker run --rm hello-world
```

Mỗi lệnh phải in phiên bản, không có `command not found`. Nếu `docker run` lỗi quyền, xem mục 21.2.

---

## 14. Cấu hình biến môi trường

### 14.0 Người mới clone repo — chạy script này

> **Nếu bạn vừa `git clone` repo này về máy mới, hãy đọc mục này trước.**
> Repo **cố ý không chứa** `.env` và `apps/api/.env.local` (chúng chứa secret
> và bị `.gitignore`). Nếu bạn chỉ `git clone` rồi `make up`, Docker Compose sẽ
> dừng ngay với `required variable AIRFLOW_FERNET_KEY is missing`.

Một lệnh duy nhất tạo đủ cấu hình với **đúng tên biến mà code thực sự đọc**:

```bash
./scripts/setup-new-machine.sh          # dùng MinIO local (mặc định)
./scripts/setup-new-machine.sh --r2     # sinh sẵn khung cấu hình Cloudflare R2
```

Script sẽ:

1. Tạo `.env` (MinIO local hoặc khung R2) + `AIRFLOW_FERNET_KEY` hợp lệ (44 ký tự).
2. Tạo `apps/api/.env.local` với `MONGO_URI` có auth, `API_CORS_ORIGINS` gồm port `5173`.
3. Kiểm tra `.env` / `apps/api/.env.local` / `R2_ENV_KEYS.txt` đã được gitignore chưa.
4. Validate `docker compose config`.
5. In ra checklist các bước còn lại (tạo bucket `lakehouse`, bootstrap admin…).

**Ba điều mà `git clone` không thể mang theo** — mỗi máy phải tự làm:

| # | Việc | Vì sao không tự động |
|---|---|---|
| 1 | Tạo bucket `lakehouse` | `minio-init` tạo `bronze`/`silver`/`gold` nhưng **không** tạo `lakehouse` — mà toàn bộ code ghi vào `s3a://lakehouse/...` |
| 2 | `pnpm --filter lakehouse-api security:bootstrap` | User nằm trong MongoDB collection `control_plane_users` **của từng máy**. Thêm admin trên GitHub **không** tạo được user trong hệ thống này |
| 3 | Điền `S3_ENDPOINT` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` | Secret của bạn. Token R2 cần quyền **Object Read & Write** trên bucket `lakehouse` |

> ⚠️ **Biến R2 phải là `S3_*`, không phải `R2_*`.** `.env.example` trước đây
> khai báo `R2_ENDPOINT_URL` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` —
> **không module nào đọc các biến đó** (`spark.py`, `env.ts`,
> `test_r2_connection.sh` đều đọc `S3_*`). Điền theo tên `R2_*` ⇒ hệ thống
> im lặng rơi về MinIO `localhost:9000` và bạn thấy `403`/`NoSuchBucket` mà
> không hiểu vì sao. `R2_ACCOUNT_ID` / `R2_ACCESS_KEY` / `R2_SECRET_KEY` chỉ
> dùng cho `r2_replicate.py` (cold-tier replicate), không phải đường chính.

### 14.1 Ba file môi trường

| File | Ai đọc | Bắt buộc? |
|---|---|---|
| `.env` (thư mục gốc) | Docker Compose (`env_file`) cho Spark, Airflow, API, worker; script Python | ✅ |
| `apps/api/.env.local` | API và worker Next.js (trong Docker hoặc trên host) | ✅ nếu dùng Control Plane |
| `apps/web/.env` | Vite (Web UI) | ❌ (có giá trị mặc định) |

Cả ba đều bị `.gitignore`. Ngoài ra `R2_ENV_KEYS.txt` cũng bị ignore (`.gitignore:120`).

> ⚠️ **`make env` dùng `cp -n`** — không ghi đè file `.env` đã có. Nếu bạn cần reset, xoá file trước rồi chạy lại.

### 14.2 Tạo `.env` ở thư mục gốc

```bash
cp .env.example .env      # hoặc: make env
```

Sửa **3 thứ bắt buộc**:

**(a) Khóa Fernet của Airflow.** Compose dùng `${AIRFLOW_FERNET_KEY:?...}` và dừng ngay nếu biến này trống. Giá trị mẫu `generate-a-fernet-key` không phải khóa hợp lệ (Fernet cần 32 byte base64 url-safe = 44 ký tự):

```bash
openssl rand -base64 32 | tr '+/' '-_'
```

Dán kết quả vào `AIRFLOW_FERNET_KEY=` trong `.env`.

**(b) Nguồn dữ liệu đọc mặc định.** `.env.example` đặt `LAKEHOUSE_DATA_SOURCE=databricks`. Nếu **không có** tài khoản Databricks:

```dotenv
LAKEHOUSE_DATA_SOURCE=local
```

Để `databricks` với token mẫu ⇒ Web UI cố đọc Databricks và báo lỗi kết nối. Đây là lỗi cấu hình, không phải lỗi mã nguồn.

**(c) Mật khẩu Gold PostgreSQL.** `GOLD_POSTGRES_PASSWORD=change-me-local` chạy được; nếu bỏ trống Compose dùng mặc định `lakehouse-local`.

### 14.3 Nhóm biến trong `.env`

| Nhóm | Biến chính | Ghi chú |
|---|---|---|
| Chung | `ENV=local`, `LOG_LEVEL=info` | `ENV` nhận `local`/`staging`/`prod` |
| MinIO | `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_SECURE` | Mặc định `localhost:9000`, `minioadmin`/`minioadmin`, `false` |
| R2 (thật) | `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION`, `S3_USE_SSL`, `S3_PATH_STYLE_ACCESS`, `S3_HEALTH_BUCKET` | Xem mục 07 |
| R2 (replicate) | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY`, `R2_SECRET_KEY` | Chỉ `r2_replicate.py` đọc |
| Kafka | `KAFKA_BOOTSTRAP`, `KAFKA_SECURITY_PROTOCOL` | Host: `localhost:9092`. Docker: `kafka:29092` |
| MongoDB | `MONGO_URI`, `MONGO_DB` | URI phải có credentials (mục 08.2) |
| Redis | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | Mặc định `localhost`, `6379`, trống |
| Airflow | `AIRFLOW_BASE_URL`, `AIRFLOW_USERNAME`, `AIRFLOW_PASSWORD`, `AIRFLOW_FERNET_KEY` | Từ host dùng cổng **8088** |
| API | `API_PORT`, `API_RATE_LIMIT_PER_MIN`, `API_CORS_ORIGINS`, `API_SWAGGER_ENABLED` | `API_AUTH_ENABLED`, `API_JWT_SECRET` xem mục 24 |
| DuckDB | `DUCKDB_MEMORY_LIMIT`, `DUCKDB_THREADS` | Mặc định `4GB`, `4` |
| Spark | `SPARK_MASTER`, `SPARK_DRIVER_MEMORY`, `SPARK_EXECUTOR_MEMORY`, `DELTA_PACKAGE`, `KAFKA_PACKAGE` | Compose ghi đè bộ nhớ cho container |
| Data Quality | `DQ_MAX_NULL_PERCENT`, `DQ_FAIL_ON_ERROR` | |
| Crawler | `TIKI_API_BASE`, `CRAWLER_RATE_LIMIT`, `CRAWLER_MAX_WORKERS`, `CRAWLER_TIMEOUT` | |
| Databricks | `DATABRICKS_HOST`, `DATABRICKS_TOKEN`, `DATABRICKS_WAREHOUSE_ID`, `DATABRICKS_HTTP_PATH`, `DATABRICKS_CATALOG`, `DATABRICKS_*_SCHEMA` | Xem mục 19 |
| Lakehouse | `LAKEHOUSE_BUCKET`, `LAKEHOUSE_DATA_SOURCE`, `LAKEHOUSE_EXECUTION_TARGET` | `LAKEHOUSE_BUCKET` mặc định `lakehouse` |
| Gold mirror | `GOLD_POSTGRES_USER`, `GOLD_POSTGRES_PASSWORD` | |
| Metabase | `METABASE_URL`, `METABASE_API_KEY` | Tùy chọn |

> ⚠️ **`.env.example` có `AIRFLOW_BASE_URL=http://localhost:8080/api/v1`** — nhưng 8080 trên host là **Spark UI**. Airflow ở **8088**. Sửa thành `AIRFLOW_BASE_URL=http://127.0.0.1:8088/api/v1`. Khi API chạy trong Docker, Compose tự ghi đè thành `http://airflow-webserver:8080/api/v1`.

> ⚠️ **`.env.example` có `R2_ENDPOINT_URL`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_BUCKET`** — không module nào đọc. Xem mục 07.1.

### 14.4 Tạo `apps/api/.env.local`

File này cần cho cả `make up-api` (Compose đọc bằng `env_file`) lẫn chạy API trên host. Thiếu ⇒ `docker compose … -f docker-compose.dev-api.yml` báo lỗi không tìm thấy file env.

```bash
cp apps/api/.env.example apps/api/.env.local
```

Sửa các dòng sau:

```dotenv
# 1) MongoDB trong Compose bật xác thực (user mongoadmin).
MONGO_URI=mongodb://mongoadmin:mongoadmin@127.0.0.1:27017/?authSource=admin
MONGO_DB=lakehouse_catalog

# 2) Từ host, Airflow ở cổng 8088 (không phải 8080)
AIRFLOW_BASE_URL=http://127.0.0.1:8088/api/v1

# 3) Không có Databricks thì đọc từ MinIO
LAKEHOUSE_DATA_SOURCE=local
LAKEHOUSE_EXECUTION_TARGET=local_delta_minio

# 4) Địa chỉ trên host
MINIO_ENDPOINT=127.0.0.1:9000
KAFKA_BOOTSTRAP=127.0.0.1:9092
REDIS_HOST=127.0.0.1
```

Khi API chạy **trong Docker**, `docker-compose.dev-api.yml` tự ghi đè `MONGO_URI`, `REDIS_HOST`, `MINIO_ENDPOINT`, `KAFKA_BOOTSTRAP`, `AIRFLOW_BASE_URL` sang tên service. Các giá trị `127.0.0.1` ở trên chỉ phục vụ chạy API trên host.

**Các biến xác thực** (định nghĩa tại `apps/api/src/config/env.ts`) — xem bảng đầy đủ ở mục 24.2.

Kiểm tra API đang đọc cấu hình nào:

```bash
cd apps/api && pnpm run env:check
```

Lệnh này in file được dùng, chế độ sở hữu, và vài giá trị (MinIO, Kafka, Mongo, Redis).

### 14.5 `apps/web/.env` (không bắt buộc)

```bash
cp apps/web/.env.example apps/web/.env
```

Mặc định đủ dùng: `VITE_API_BASE_URL` để trống (trình duyệt gọi cùng origin), Vite proxy `/api` → `API_PROXY_TARGET=http://127.0.0.1:3001`. Chỉ đổi `API_PROXY_TARGET` nếu API chạy ở máy hoặc cổng khác.

### 14.6 Cài dependency

**Node (API, Web, workspace):**

```bash
pnpm install --frozen-lockfile
```

Cài cho cả `apps/api` (`lakehouse-api`) và `apps/web` (`@lakehouse/web`) theo `pnpm-workspace.yaml`. `--frozen-lockfile` giữ đúng phiên bản trong `pnpm-lock.yaml` (CI cũng dùng cờ này).

Kiểm tra: `pnpm -r exec node -v` và thư mục `node_modules/` xuất hiện.
Nếu `corepack` lỗi quyền: `npm install -g pnpm@9.15.9`.

**Python (tùy chọn nhưng khuyến nghị):**

Cần Python trên host để chạy `make mock-retail`, `make scheduler`, `scripts/produce_kafka.sh`, `pytest`, `ruff`, `black`, `mypy`. Stack Docker **không** cần bước này.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -e ".[dev]"            # tương đương `make install` sau khi venv đã có
```

> ⚠️ **Thư mục venv phải tên `.venv` (có dấu chấm).** `Makefile` và các script (`produce_kafka.sh`, `run_crawl_scheduler.sh`) tìm đúng tên này. Repo cũng có `venv/` (không dấu chấm) từ lần cài trước và nó **không** được dùng.

Kiểm tra: `python -c "import lakehouse, pyspark, delta; print('ok')"`.
Gói `lakehouse` kéo `pyspark`, `delta-spark`, `great-expectations` — có thể mất vài phút.

---

## 15. Quick Start

Tóm tắt ngắn nhất để có một stack chạy được. Chi tiết từng bước ở mục 16.

```bash
# 0. Docker Desktop đang chạy
docker version && docker compose version

# 1. Mã nguồn + cấu hình
cd /Users/mac/Documents/data-lake-architecture
git checkout main
cp .env.example .env
cp apps/api/.env.example apps/api/.env.local
mkdir -p data-samples airflow_logs

# 2. Sửa .env: AIRFLOW_FERNET_KEY (openssl rand -base64 32 | tr '+/' '-_')
#    Sửa .env: LAKEHOUSE_DATA_SOURCE=local
#    Sửa apps/api/.env.local: MONGO_URI có credentials, AIRFLOW_BASE_URL=:8088

# 3. Cài dependency Node
pnpm install --frozen-lockfile

# 4. Build image tuần tự (giảm tải RAM)
export COMPOSE_PARALLEL_LIMIT=1
docker compose -f docker-compose.yml -f docker-compose-kafka.yml build airflow-webserver spark-master
docker compose -f docker-compose.yml -f docker-compose-kafka.yml -f docker-compose.dev-api.yml build api worker web

# 5. Khởi động
make up-api

# 6. Tạo bucket "lakehouse" — minio-init KHÔNG tạo bucket này
docker compose -f docker-compose.yml -f docker-compose-kafka.yml run --rm --no-deps --entrypoint /bin/sh minio-init \
  -c 'mc alias set local http://minio:9000 minioadmin minioadmin >/dev/null && mc mb --ignore-existing local/lakehouse && mc ls local/'

# 7. Kiểm tra
make ps
make health
curl -s localhost:3001/api/health
curl -s localhost:3001/api/health/deep
```

Mở trình duyệt:

| URL | Dịch vụ |
|---|---|
| http://localhost:5173 | Web UI |
| http://localhost:3001/api-doc | Swagger |
| http://localhost:9001 | MinIO Console (`minioadmin`/`minioadmin`) |
| http://localhost:8088 | Airflow (`admin`/`admin`) |
| http://localhost:8080 | Spark Master UI |
| http://localhost:8081 | Kafka UI |
| http://localhost:3000 | Metabase |

---

## 16. Hướng dẫn khởi động từng Terminal

### 16.1 Ma trận Terminal

Hệ thống cần **3 terminal tiêu chuẩn** để chạy đầy đủ Control Plane, **4 terminal** nếu bạn dùng Cloudflare Pages, và **+1 terminal** cho mọi job chạy lâu (streaming job, scheduler).

| Terminal | Mục đích | Thư mục | Lệnh | Chạy nền? | Phụ thuộc | Cách kiểm tra |
|---|---|---|---|---|---|---|
| **T1** | Hạ tầng Docker | repo root | `make up-api` | Nền (container) | Docker Desktop | `make ps`, `make health` |
| **T2** | API + Worker (dev host, hot reload) | `apps/api` | `pnpm --filter lakehouse-api dev` | Tiền cảnh | T1 healthy | `curl localhost:3001/api/health` |
| **T3** | Web UI (dev host, hot reload) | `apps/web` | `pnpm --filter @lakehouse/web dev` | Tiền cảnh | T2 | mở http://localhost:5173 |
| **T4** *(tuỳ chọn)* | Cloudflare Quick Tunnel | bất kỳ | `cloudflared tunnel --protocol http2 --url http://127.0.0.1:3001` | Tiền cảnh | T2 | `curl -fsS https://<hostname>.trycloudflare.com/api/health` |
| **T5** *(tuỳ chọn)* | Job chạy lâu: streaming job, scheduler, producer | repo root | `make stream-clickstream` / `make scheduler` / `bash scripts/produce_kafka.sh …` | Tiền cảnh | T1, Kafka healthy | log trực tiếp trong terminal |

**Quy ước:** T1 dùng `up -d` nên **không chiếm terminal**. T2–T5 chiếm terminal — mở tab mới trong Terminal.app/iTerm, hoặc dùng `tmux`.

> **Chọn một trong hai chế độ Control Plane — không chạy cả hai cùng lúc:**
>
> - **Chế độ Docker (khuyến nghị):** `make up-api`. API + worker + web đều trong container. Ổn định, không cần Node/Java trên host.
> - **Chế độ dev host (hot reload):** dừng container `api`/`web`, chạy T2/T3 trên host. Nhanh hơn khi sửa TypeScript.

### 16.2 Terminal 1 — Hạ tầng Docker

```bash
cd /Users/mac/Documents/data-lake-architecture
```

**Bước 1.1 — Khởi động Docker Desktop.**

```bash
open -a Docker
```

Chờ biểu tượng cá voi chuyển sang trạng thái chạy, rồi:

```bash
docker version           # Server version phải có
docker compose version  # v2.x
docker info --format '{{.MemTotal}} bytes, {{.NCPU}} cpus'
```

**Bước 1.2 — Chuẩn bị thư mục bind-mount.**

```bash
mkdir -p data-samples airflow_logs
```

Bỏ qua bước này trên Linux ⇒ Docker tạo thư mục với owner `root` và bạn không ghi được từ host.

**Bước 1.3 — Build image (tuần tự, giảm tải RAM).**

```bash
export COMPOSE_PARALLEL_LIMIT=1
docker compose -f docker-compose.yml -f docker-compose-kafka.yml build airflow-webserver spark-master
docker compose -f docker-compose.yml -f docker-compose-kafka.yml -f docker-compose.dev-api.yml build api worker web
```

Image worker `FROM lake-airflow:2.7.0` ⇒ **phải build `airflow-webserver` trước**. Lần build đầu cần Internet (JDK từ GitHub, JAR từ Maven Central, image gốc từ Docker Hub).

**Bước 1.4 — Khởi động core + Kafka + Control Plane.**

```bash
make up-api
```

`make up-api` = `docker compose -f docker-compose.yml -f docker-compose-kafka.yml -f docker-compose.dev-api.yml up -d` rồi `sleep 60`. **Dịch vụ có thể cần thêm thời gian** để healthy.

**Bước 1.5 — Tạo bucket `lakehouse`.**

`minio-init` chỉ tạo `bronze`/`silver`/`gold`. Toàn bộ code ghi vào `s3a://lakehouse/...` ⇒ **phải tạo tay**:

```bash
docker compose -f docker-compose.yml -f docker-compose-kafka.yml run --rm --no-deps --entrypoint /bin/sh minio-init \
  -c 'mc alias set local http://minio:9000 minioadmin minioadmin >/dev/null && mc mb --ignore-existing local/lakehouse && mc ls local/'
```

Hoặc dùng MinIO Console (http://localhost:9001) → **Buckets → Create Bucket** → tên `lakehouse`.

**Bước 1.6 — Kiểm tra.**

```bash
make ps
make health
docker exec lake-kafka kafka-topics --bootstrap-server kafka:29092 --list
docker exec lake-minio mc ls local/
```

Kỳ vọng:

- Các container: `lake-minio`, `lake-postgres`, `lake-gold-postgres`, `lake-spark-master`, `lake-spark-worker`, `lake-airflow-db`, `lake-airflow-webserver`, `lake-airflow-scheduler`, `lake-mongo`, `lake-redis`, `lake-zookeeper`, `lake-kafka`, `lake-kafka-ui`, `lake-api`, `lake-worker`, `lake-web` — `healthy` hoặc `Up`.
- Bucket: `bronze`, `gold`, `lakehouse`, `silver`.
- Topic: đủ 7 topic.
- `make health` in `✓` cho MinIO, Spark Master, Kafka UI, Airflow; `!` (optional, màu vàng) cho API/Web/Mongo/Redis/Metabase nếu chưa bật.

Nếu thiếu topic (kafka-init chạy lúc Kafka chưa sẵn sàng):

```bash
docker compose -f docker-compose.yml -f docker-compose-kafka.yml up kafka-init
```

**Bước 1.7 — Bật DAG trong Airflow (nếu cần).**

```bash
docker exec lake-airflow-webserver airflow dags list
docker exec lake-airflow-webserver airflow dags unpause retail_elt_dag
```

DAG bị pause sẽ không chạy dù bạn bấm Trigger. `RUNTIME VERIFIED` — trên máy này cả 4 DAG đều `paused=False`.

**Khi nào sang Terminal tiếp theo:** khi `make health` báo hết các service `critical` là `✓`.

### 16.3 Terminal 2 — API + Worker

**Cách A — trong Docker (khuyến nghị).** Không cần terminal riêng; container `lake-api` và `lake-worker` đã chạy từ Terminal 1.

```bash
# Kiểm tra
curl -s localhost:3001/api/health
curl -s localhost:3001/api/health/deep
docker logs --tail 50 lake-api
docker logs --tail 50 lake-worker
```

`lake-worker` **không có healthcheck** nên hiển thị `Up` chứ không phải `healthy` — đó là bình thường.

**Cách B — trên host (hot reload).**

1. Dừng container `api` và `web` để không tranh cổng 3001 / 5173 (giữ `worker` chạy):

```bash
docker compose -f docker-compose.yml -f docker-compose-kafka.yml -f docker-compose.dev-api.yml stop api web
```

2. Trong Terminal 2:

```bash
cd /Users/mac/Documents/data-lake-architecture/apps/api
pnpm --filter lakehouse-api dev
```

Script `dev` chạy song song `next dev -p 3001` **và** `tsx src/workers/main.ts` (concurrently, `--kill-others-on-fail`). Nếu bạn chỉ muốn API:

```bash
pnpm --filter lakehouse-api dev:api
```

3. Kiểm tra cấu hình trước khi chạy:

```bash
cd /Users/mac/Documents/data-lake-architecture/apps/api && pnpm run env:check
```

> ⚠️ Nếu bạn tự chạy worker trên host, máy phải có Java 17 và `pip install -e .`, đồng thời đặt `LAKEHOUSE_PYTHON=$(pwd)/.venv/bin/python`. Nếu không, **để worker trong Docker** — nó đã có sẵn Python, JDK 17 và Spark.

**Dừng:** `Ctrl+C` trong terminal, hoặc `docker compose … stop api web` nếu chạy trong Docker.

### 16.4 Terminal 3 — Web UI

**Cách A — trong Docker.** Không cần terminal riêng; container `lake-web` phục vụ nginx ở 5173.

```bash
curl -s -o /dev/null -w "%{http_code}\n" localhost:5173
```

**Cách B — trên host (hot reload).**

```bash
cd /Users/mac/Documents/data-lake-architecture/apps/web
pnpm --filter @lakehouse/web dev
```

Vite chạy ở `localhost:5173` với `strictPort: true` và `host: true`. Proxy `/api` → `API_PROXY_TARGET` (mặc định `http://127.0.0.1:3001`).

**Dấu hiệu thành công:** Vite in `Local: http://localhost:5173/`; trình duyệt mở được; DevTools → Network thấy request `/api/...` trả 200 (không phải 404 do proxy sai).

**Dừng:** `Ctrl+C`.

### 16.5 Terminal 4 (tuỳ chọn) — Cloudflare Quick Tunnel

Chỉ cần khi muốn truy cập UI từ máy khác hoặc deploy lên Cloudflare Pages. Chi tiết ở mục 24 và `docs/operations/RESTART_LOCAL_R2_TUNNEL.md`.

```bash
cloudflared tunnel --protocol http2 --url http://127.0.0.1:3001
```

Để terminal chạy liên tục. `cloudflared` in hostname dạng `https://<hostname>.trycloudflare.com` — **không cố định giữa các phiên**.

Kiểm tra từ terminal khác:

```bash
curl -fsS https://<hostname>.trycloudflare.com/api/health
```

Nếu log hiện `Unauthorized: Tunnel not found` hoặc `connection terminated` kéo dài ⇒ tunnel đó không dùng được. `Ctrl+C`, tạo tunnel mới, rồi build/deploy lại frontend với hostname mới.

### 16.6 Terminal 5 (tuỳ chọn) — Job chạy lâu

Chỉ mở khi chạy streaming job, scheduler hoặc producer. **Không chạy producer/consumer khi broker chưa sẵn sàng**; **không chạy streaming job trước khi storage/checkpoint sẵn sàng**.

```bash
cd /Users/mac/Documents/data-lake-architecture

# Streaming (giữ terminal để xem log Spark)
make stream-clickstream

# Crawler scheduler (nền)
make scheduler-daemon
make scheduler-list
make scheduler-stop

# Producer
bash scripts/produce_kafka.sh clickstream-events 500 20
```

### 16.7 Flowchart khởi động

```mermaid
flowchart TD
    A["Mở Docker Desktop"] --> B["docker version<br/>docker compose version"]
    B --> C["mkdir -p data-samples airflow_logs"]
    C --> D["cp .env.example .env<br/>cp apps/api/.env.example apps/api/.env.local"]
    D --> E["Sửa AIRFLOW_FERNET_KEY<br/>LAKEHOUSE_DATA_SOURCE=local<br/>MONGO_URI có credentials"]
    E --> F["pnpm install --frozen-lockfile"]
    F --> G["COMPOSE_PARALLEL_LIMIT=1<br/>build image tuần tự"]
    G --> H["make up-api"]
    H --> I{"Tất cả service healthy?"}
    I -->|Không| J["docker logs &lt;container&gt;<br/>kiểm tra .env / .env.local"]
    J --> H
    I -->|Có| K["Tạo bucket 'lakehouse'"]
    K --> L{"Bạn chạy Control Plane ở đâu?"}
    L -->|"Docker (chế độ A)"| M["Mở http://localhost:5173"]
    L -->|"Host (chế độ B)"| N["T2: stop api/web container<br/>pnpm --filter lakehouse-api dev"]
    N --> O["T3: pnpm --filter @lakehouse/web dev"]
    O --> M
    M --> P{"Cần truy cập từ máy khác?"}
    P -->|Không| Q["Xong — chạy pipeline"]
    P -->|Có| R["T4: cloudflared tunnel<br/>--protocol http2"]
    R --> S["Build + deploy Web lên Pages<br/>với hostname mới"]
    S --> Q
```

### 16.8 Các chế độ chạy

| Chế độ | Thành phần | Lệnh |
|---|---|---|
| **Minimal** (xem UI + đọc dữ liệu) | Core stack + API + Web. **Không** cần Spark cluster | `docker compose -f docker-compose.yml -f docker-compose-kafka.yml -f docker-compose.dev-api.yml up -d minio mongo redis gold-postgres api web` |
| **Full development** | Toàn bộ 19 service | `make up-api` |
| **Data pipeline** | Core + Spark + Airflow + dữ liệu mock | `make up` → `make mock-retail` → `make pipeline-batch` |
| **Streaming** | Core + Kafka + producer + streaming job | `make up` → `make produce-clickstream` → `make stream-clickstream` |
| **R2** | Core với `S3_ENDPOINT` trỏ R2 | Xem mục 07 |

> **Chế độ Minimal không chạy `spark-master`/`spark-worker`/`metabase`.** Nếu Docker chỉ có 8 GB RAM và các container này bị OOM-kill, đây là cách giảm tải hiệu quả nhất. API đọc dữ liệu bằng DuckDB, không cần Spark.

### 16.9 Dừng, khởi động lại, dọn dẹp

| Việc | Lệnh | Tác động dữ liệu |
|---|---|---|
| Dừng frontend (dev host) | `Ctrl+C` ở T3 | Không |
| Dừng API (dev host) | `Ctrl+C` ở T2 | Không |
| Dừng toàn bộ Control Plane | `make down-api` | Giữ volume |
| Dừng core stack | `make down` | Giữ volume |
| Dừng một container | `docker compose -f docker-compose.yml -f docker-compose-kafka.yml stop <service>` | Giữ volume |
| Khởi động lại một container | `docker compose -f docker-compose.yml -f docker-compose-kafka.yml restart <service>` | Giữ volume |
| Rebuild API | `docker compose -f docker-compose.yml -f docker-compose-kafka.yml -f docker-compose.dev-api.yml up -d --build api` | Giữ volume |
| **Xoá toàn bộ dữ liệu** | `make reset` | ⚠️ **KHÔNG THỂ HOÀN TÁC** |

`make reset` chạy `scripts/reset.sh`: hỏi xác nhận 2 bước (bước 2 phải gõ `RESET`), rồi `docker compose … down -v` (xoá mọi volume: MinIO, Postgres, Airflow DB, Kafka, Mongo, Redis) và `rm -rf data-samples/*`.

> ⚠️ `make clean` là **bí danh cũ của `make reset`**, không phải lệnh dọn file tạm. Đừng gõ nhầm. Lệnh dọn an toàn là `make clean-pyc` (xoá `__pycache__`).

Sau `make reset` phải làm lại: build image → `make up-api` → tạo bucket `lakehouse` → sinh dữ liệu mock.

---

## 17. Hướng dẫn chạy pipeline dữ liệu

Điều kiện: Terminal 1 đã chạy `make up-api` (hoặc `make up`), bucket `lakehouse` tồn tại.

### 17.1 Sinh dữ liệu mock

```bash
cd /Users/mac/Documents/data-lake-architecture
make mock-retail
```

Kết quả: 200 khách hàng, 50 sản phẩm, 1000 đơn hàng → `data-samples/crm/customers.csv`, `data-samples/erp/products.csv`, `data-samples/erp/orders.json`.

### 17.2 Pipeline batch Bronze → Silver → Gold

```bash
make pipeline-batch
# tương đương: bash scripts/run_batch_pipeline.sh --pipeline batch_retail
```

Xem trước lệnh mà không chạy:

```bash
bash scripts/run_batch_pipeline.sh --pipeline batch_retail --dry-run
```

Lần đầu `spark-submit` tải `delta-spark`, `hadoop-aws`, `aws-java-sdk-bundle` từ Maven Central vào `/tmp/.ivy2` của container ⇒ cần Internet và chậm hơn các lần sau.

**Từng tầng riêng:**

```bash
make pipeline-bronze     # nạp CSV vào Bronze
make pipeline-silver     # CHỈ transform customers
make pipeline-gold       # CHỈ aggregate fact_orders
```

> ⚠️ `make pipeline-silver` và `make pipeline-gold` chỉ chạy **một** transformer/aggregator và chỉ truyền gói `delta-spark` (thiếu `hadoop-aws` + `aws-java-sdk-bundle` cần cho S3A). Nếu lỗi khi đọc/ghi S3, dùng `make pipeline-batch`.

### 17.3 Qua Airflow (có đồ thị phụ thuộc, retry, log từng task)

```bash
docker exec lake-airflow-webserver airflow dags unpause retail_elt_dag
make airflow-trigger      # = airflow dags trigger retail_elt_dag
```

Theo dõi tại http://localhost:8088 → tab **Graph** hoặc **Grid**.
DAG không có lịch (`schedule_interval=None`) — chỉ chạy khi trigger. `MAX_ACTIVE_TASKS_PER_DAG=1` ⇒ chậm hơn `make pipeline-batch` nhưng ổn định hơn về bộ nhớ.

### 17.4 Kiểm tra dữ liệu

```bash
make pipeline-verify            # scripts/verify_lake_data.sh — liệt kê object từng tầng
bash scripts/verify_phase3.sh   # kiểm tra dữ liệu batch sau pipeline
```

Mã thoát `verify_phase3.sh`: `0` đạt, `1` có kiểm tra thất bại, `2` stack chưa chạy.

Duyệt trực tiếp: MinIO Console → bucket `lakehouse` → `bronze/`, `silver/`, `gold/`.

> Tài liệu này không nêu số dòng kỳ vọng cứng cho từng tầng — số dòng phụ thuộc phép làm sạch và khử trùng lặp. Đối chiếu với kết quả `make pipeline-verify` trên máy bạn.

### 17.5 Streaming

```bash
make produce-clickstream
bash scripts/produce_kafka.sh clickstream-events 500 20
make stream-clickstream
make stream-ecommerce
make aggregate-clickstream-unique
```

### 17.6 Đồng bộ Gold sang PostgreSQL (Metabase)

```bash
bash scripts/sync_gold_to_metabase.sh
```

Chạy sau khi Gold có dữ liệu. Script chạy `spark-submit` trong container Spark với gói `org.postgresql:postgresql:42.7.4`, ghi **ghi đè** (`overwrite`) 4 bảng `fact_orders`, `daily_revenue`, `dim_customers`, `dim_products` vào schema `public` của `gold_analytics`.

Nếu một bảng Gold chưa tồn tại, script dừng với `Gold Delta table ... was not found` ⇒ phải chạy pipeline batch trước. Script từ chối chạy khi `LAKEHOUSE_DATA_SOURCE=databricks`.

Kiểm tra:

```bash
docker exec lake-gold-postgres psql -U metabase -d gold_analytics -c "\dt"
```

### 17.7 Demo không cần Docker

```bash
make demo
```

Chạy Bronze → Silver → Gold ngay trên host (`experiments.demo_local_pipeline`), không cần MinIO, Airflow hay Kafka. Cần Java 17 và gói Python `lakehouse`.

Thêm: `make experiment-01` (schema evolution + time travel + OPTIMIZE), `make experiment-02` (so sánh ETL/ELT), `make experiment-03` (benchmark ingest/transform/query/partition pruning).

---

## 18. Xác minh API & Frontend

### 18.1 Health

```bash
curl -s localhost:3001/api/health
curl -s localhost:3001/api/health/deep
```

`/api/health` trả nhanh với các dependency ở trạng thái `skipped` (`mode: deep-only`). `/api/health/deep` probe từng dependency kèm latency.

### 18.2 Script kiểm tra toàn bộ dev endpoint

```bash
bash scripts/check_dev_links.sh              # hoặc: make health
bash scripts/check_dev_links.sh --verbose
bash scripts/check_dev_links.sh --only streaming
```

Chia theo mức: `critical` (MinIO, Spark Master, Kafka UI, Airflow) và `optional` (API, Web, MongoDB, Redis, Metabase). Exit code `1` nếu có service critical down.

### 18.3 Script kiểm tra Control Plane (23 endpoint)

```bash
node scripts/verify-control-plane.mjs
```

Gọi 23 endpoint `GET` của API (`health`, `health/deep`, `catalog/databases`, `catalog/tables`, `bronze`, `bronze/jobs`, `bronze/jobs/stats`, `silver`, `silver/jobs`, `silver/jobs/stats`, `gold`, `gold/jobs`, `gold/jobs/stats`, `crawler`, `crawler/stats`, `kafka/topics`, `kafka/consumer-groups`, `kafka/stats`, `airflow/dags`, `airflow/stats`, `dq/rules`, `dq/runs`, `dq/summary`), in mã HTTP từng endpoint, ghi `test-results/api-results.json`, thoát mã `1` nếu có endpoint lỗi hoặc không trả 200.

API mặc định ở `http://127.0.0.1:3001`, đổi bằng `API_VERIFY_URL`. Script **không** gửi token ⇒ khi `API_AUTH_ENABLED=true` các endpoint cần xác thực sẽ trả `401`.

### 18.4 Điểm kiểm tra khác

```bash
# Buckets
docker exec lake-minio mc ls local/
docker exec lake-minio mc ls --recursive local/lakehouse/ | head -20

# Topics
docker exec lake-kafka kafka-topics --bootstrap-server kafka:29092 --list

# Spark workers
curl -s http://localhost:8080 | grep -i "alive workers" | head -1

# Airflow
curl -fsS -u admin:admin http://localhost:8088/api/v1/health
docker exec lake-airflow-webserver airflow dags list

# Gold mirror
docker exec lake-gold-postgres psql -U metabase -d gold_analytics -c "\dt"

# Worker
docker logs --tail 50 lake-worker
docker exec lake-redis redis-cli ping
```

### 18.5 Swagger

http://localhost:3001/api-doc — `/api/docs` chuyển hướng tới đó. Bật/tắt bằng `API_SWAGGER_ENABLED`.

---

## 19. Vận hành Cloud Storage / R2

Các lệnh cụ thể ở mục 07. Tóm tắt thao tác an toàn:

```bash
# 1. Xác nhận biến R2 đã đúng tên (không in giá trị)
grep -E '^(S3_ENDPOINT|S3_ACCESS_KEY|S3_SECRET_KEY)=' .env | sed 's/=.*/=<set>/'

# 2. Liệt kê bucket (read-only)
npx wrangler r2 bucket list

# 3. Liệt kê object (read-only)
npx wrangler r2 object list lakehouse --prefix bronze

# 4. Script kiểm tra chuyên dụng
bash scripts/test_r2_connection.sh

# 5. Kiểm tra Spark ghi/đọc được bảng Delta tạm trên R2
make verify-r2        # scripts/verify_r2.py — yêu cầu S3_ENDPOINT được đặt

# 6. Lifecycle policy
export CF_ACCOUNT_ID="<your-32-char-hex-account-id>"
wrangler r2 bucket lifecycle set bronze --policy infra/r2/lifecycle-bronze.json --remote
wrangler r2 bucket lifecycle get bronze
```

> ⛔ **Không chạy bulk sync / bulk delete trên R2 chỉ để kiểm chứng tài liệu.** `aws s3 sync` và `wrangler r2 object delete` ghi/xoá trên cloud, phát sinh chi phí và thay đổi trạng thái hạ tầng.

### 19.1 Databricks (tùy chọn)

Mặc định `LAKEHOUSE_DATA_SOURCE=local`. Khi muốn dùng Databricks:

```dotenv
LAKEHOUSE_DATA_SOURCE=databricks
DATABRICKS_HOST=https://<workspace>.cloud.databricks.com
DATABRICKS_TOKEN=<token-cua-ban>
DATABRICKS_WAREHOUSE_ID=<warehouse-id>
DATABRICKS_HTTP_PATH=/sql/1.0/warehouses/<warehouse-id>
DATABRICKS_CATALOG=workspace
DATABRICKS_BRONZE_SCHEMA=bronze
DATABRICKS_SILVER_SCHEMA=silver
DATABRICKS_GOLD_SCHEMA=gold
```

Lệnh hỗ trợ:

```bash
ENV=databricks make databricks-dryrun   # in cấu trúc lưu trữ đã phân giải
make databricks-diag                     # kiểm tra xác thực (KHÔNG in token)
make databricks-bootstrap                # tạo catalog, 3 schema, 4 volume trong Unity Catalog
```

Khi `LAKEHOUSE_DATA_SOURCE=databricks`, API đọc qua SQL Warehouse và `/api/health/deep` có mục Databricks (`up` khi warehouse `RUNNING`). `sync_gold_to_metabase.sh` **không** dùng được ở chế độ này.

> ⚠️ **Token Databricks là bí mật.** Chỉ để trong `.env` (đã git-ignore). Nếu lỡ lộ, thu hồi ngay.
> `DOCUMENTED BUT UNTESTED` — không có workspace Databricks thật nào được đụng tới trong phiên audit này.

---

## 20. Kiểm thử & bảo đảm chất lượng

### 20.1 Python (thư mục gốc)

Cần `.venv` đã cài `pip install -e ".[dev]"`.

```bash
make test         # pytest kèm coverage (cấu hình trong pyproject.toml)
make test-fast    # pytest không coverage
make lint         # ruff check src tests
make format       # black + ruff --fix (CÓ SỬA FILE)
make typecheck    # mypy src
make check        # cổng CI nhanh: ruff + black --check + pytest, không sửa file
make verify       # lint + format + test + scripts/verify.sh
```

Python tối thiểu 3.10, độ dài dòng 100. Một số test cần PySpark và Java 17.

**20 test file** trong `tests/`, trong đó có các test quan trọng cho tài liệu này:

| Test | Phủ cái gì |
|---|---|
| `test_env_parity.py` | Loader Python và JS cho kết quả giống nhau |
| `test_s3a_config.py` | Cấu hình S3A, validate `S3_ENDPOINT` và credential |
| `test_r2_replicate.py` | Script replicate MinIO → R2 |
| `test_lake_paths.py`, `test_paths.py` | Đường dẫn chuẩn theo storage env |
| `test_airflow_dag_config.py` | Cấu hình DAG (thêm trong `bbfcf76`) |
| `test_pipeline_idempotency.py` | Chạy lại ingestion không nhân bản |
| `test_streaming_correctness.py` | Tính đúng của pipeline streaming |
| `test_crawl_scheduler.py`, `test_crawlers.py` | Scheduler và crawler |

### 20.2 API (Vitest)

```bash
pnpm --filter lakehouse-api typecheck
pnpm --filter lakehouse-api test
pnpm --filter lakehouse-api lint      # next lint — có thể hỏi cấu hình ESLint nếu repo chưa có
```

`apps/api/tests/unit/` (1 file) và `apps/api/tests/integration/` (25 file) — gồm Airflow, Bronze, Gold, Catalog, Crawler, DQ, EDA, Kafka, Databricks, health, security, transport, operation ownership.

### 20.3 Web (Vitest và Playwright)

```bash
pnpm --filter @lakehouse/web typecheck
pnpm --filter @lakehouse/web test
pnpm --filter @lakehouse/web test:e2e
```

Playwright (`apps/web/playwright.config.ts`) tự khởi động Vite trên `127.0.0.1:5174`, đổi bằng `BROWSER_BASE_URL`. Lần đầu: `pnpm --filter @lakehouse/web exec playwright install`.

5 spec trong `apps/web/e2e/`: `databricks`, `interactions`, `picker-flows`, `screens`, `tabbed-screens`.

### 20.4 CI (GitHub Actions)

`.github/workflows/ci.yml` — chạy khi push/PR lên `main`, 4 job:

| Job | Nội dung |
|---|---|
| `python` | ruff → black --check → mypy → pytest (`ubuntu-latest`, Python 3.12) |
| `node-web` | `tsc --noEmit` → `pnpm test` → `pnpm build` (Node 20, pnpm 9) |
| `node-api` | typecheck → test → build (với env placeholder `MINIO_*`, `KAFKA_BOOTSTRAP`) |
| `docker-compose` | `docker compose -f docker-compose.yml -f docker-compose-kafka.yml config --quiet` |

> Job `docker-compose` **chỉ validate compose core + kafka**, không validate overlay `dev-api`. Nếu sửa `docker-compose.dev-api.yml`, hãy chạy `docker compose -f docker-compose.yml -f docker-compose-kafka.yml -f docker-compose.dev-api.yml config --quiet` cục bộ.

### 20.5 Kiểm tra tính toàn vẹn

```bash
bash scripts/verify.sh
```

Script kiểm tra: Python compile, import `lakehouse`, file env tồn tại, compose config hợp lệ (core+kafka và cả dev-api), và cảnh báo nếu file `docker-compose.api.yml` legacy còn tồn tại.

---

## 21. Xử lý sự cố

### 21.1 Build image bị kill, mã thoát 137, hoặc máy đứng

**Nguyên nhân:** `next build` và build image Airflow dùng nhiều RAM; Docker VM bị cạn bộ nhớ. Đã quan sát trực tiếp: `lake-spark-master`, `lake-spark-worker`, `lake-metabase` bị OOM-killed (`Exit 137`) khi Docker có 7,75 GiB.

- Tăng RAM cho Docker (Docker Desktop → Settings → Resources; trên WSL2 sửa `%UserProfile%\.wslconfig`, mục 13.3).
- Build tuần tự: `export COMPOSE_PARALLEL_LIMIT=1`, build từng image một.
- `Dockerfile` API đã đặt `NEXT_BUILD_CPUS=2` — không nên tăng khi RAM thấp.
- Tắt bớt ứng dụng nặng trong lúc build.
- Kiểm tra container nào bị OOM: `docker inspect lake-spark-master --format '{{.State.OOMKilled}}'`.

### 21.2 `Cannot connect to the Docker daemon` hoặc `permission denied` với `/var/run/docker.sock`

- macOS/Windows: mở Docker Desktop, chờ biểu tượng báo "running".
- Linux: `sudo usermod -aG docker "$USER"` rồi đăng xuất/đăng nhập lại, hoặc `newgrp docker`.
- WSL2: bật WSL integration cho distro trong Docker Desktop → Settings → Resources → WSL integration.

### 21.3 Cổng đã bị chiếm

```bash
lsof -nP -iTCP:3001 -sTCP:LISTEN
```

Windows PowerShell: `Get-NetTCPConnection -LocalPort 3001 | Select-Object OwningProcess`, rồi `Get-Process -Id <PID>`.

Các va chạm thường gặp: 8080 là Spark Master UI (Airflow ở **8088**); 3000 là Metabase; 3001 là API; 5173 là Web (`strictPort` ⇒ thoát luôn); 27017/6379 có thể trùng dịch vụ cài sẵn.

Nếu `make up-api` chạy cùng lúc với `pnpm dev` trên host ⇒ hai bên tranh cổng 3001/5173. Chỉ chọn một.

### 21.4 Airflow không khởi động: `Fernet key must be 32 url-safe base64-encoded bytes`

`.env.example` đặt `AIRFLOW_FERNET_KEY=generate-a-fernet-key` — không hợp lệ.

```bash
openssl rand -base64 32 | tr '+/' '-_'
```

Dán vào `.env`, rồi `docker compose -f docker-compose.yml -f docker-compose-kafka.yml up -d airflow-webserver airflow-scheduler`.

### 21.5 Build `lake-airflow` lỗi checksum hoặc `exec format error` trên máy x64

`Dockerfile.airflow` cố định URL và SHA-256 của JDK **aarch64**. Trên Mac Intel, Windows x64, Linux x64 phải đổi sang `x64` theo mục 13.4.

### 21.6 Spark/Airflow báo `Connection refused` hoặc `Py4JNetworkError: Answer from Java side is empty`

**Nguyên nhân thường gặp:** JVM bị kernel kill do hết bộ nhớ (OOM). Ba task Bronze của `retail_elt_dag` khởi động cùng lúc, mỗi task một Spark driver.

Compose đã đặt `SPARK_DRIVER_MEMORY=768m`, `SPARK_EXECUTOR_MEMORY=768m`, `SPARK_MASTER=local[2]`, `MAX_ACTIVE_TASKS_PER_DAG=1` để giữ trong giới hạn.

- Tăng RAM cho Docker (mục 21.1).
- Không nâng `SPARK_DRIVER_MEMORY` nếu RAM chưa tăng.
- Xem log task: Airflow UI → DAG → Grid → chọn task → Logs; hoặc `docker logs lake-airflow-scheduler`.

### 21.7 Pipeline lỗi vì bucket hoặc đường dẫn S3 không tồn tại

`NoSuchBucket` / `The specified bucket does not tồn tại` ⇒ `minio-init` không tạo bucket `lakehouse`. Tạo theo mục 16.2 bước 1.5.

> **Trên Cloudflare R2:** bucket canonical vẫn là `lakehouse` — **không** phải 3
> bucket `bronze`/`silver`/`gold`. Tầng medallion là *prefix* bên trong bucket:
> `s3a://lakehouse/bronze/crm/customers`. Tạo sai tên ⇒ `NoSuchBucket` hoặc 403.

### 21.7b R2 trả `403 Forbidden` / `AccessDenied` / `Authentication error [code: 10000]`

| Mã / triệu chứng | Nguyên nhân | Cách sửa |
|---|---|---|
| `403 AccessDenied` | Token R2 thiếu quyền **Object Read & Write**, hoặc chỉ được gán cho bucket khác | Tạo lại token, chọn đúng bucket `lakehouse` |
| `403` khi đã có quyền | Đang dùng **nhầm tên biến** `R2_*` thay vì `S3_*` | Code chỉ đọc `S3_ENDPOINT` / `S3_ACCESS_KEY` / `S3_SECRET_KEY`. Đổi tên biến |
| `403` + hệ thống im lặng rơi về MinIO | Đặt `R2_ENDPOINT_URL` (không ai đọc) thay vì `S3_ENDPOINT` | Xem mục 14.0 |
| `code: 10000` (wrangler) | `wrangler` chưa login hoặc login sai account | `wrangler logout && wrangler login && wrangler whoami` |
| `NoSuchBucket` | Bucket `lakehouse` chưa tạo trên R2 dashboard | Tạo 1 bucket tên `lakehouse` (Region: auto, Private) |
| `400 Path style access is not supported` | Thiếu `S3_PATH_STYLE_ACCESS=true` | Bổ sung biến này (mặc định đã là `true` ở API) |

### 21.7c Người khác clone repo về không chạy được

| Triệu chứng | Nguyên nhân | Cách sửa |
|---|---|---|
| `required variable AIRFLOW_FERNET_KEY is missing` | Clone không có `.env` (bị gitignore) | Chạy `./scripts/setup-new-machine.sh` |
| Compose báo không tìm thấy file `.env` | `env_file: .env` trong `docker-compose.yml` | Tạo `.env` (mục 14.2) |
| Điền R2 xong vẫn 403 / không kết nối được R2 | Dùng tên biến `R2_*` thay vì `S3_*` | Mục 14.0 |
| Không đăng nhập được dù đã là admin | User nằm trong MongoDB **của máy đó**, không phải trên GitHub | `pnpm --filter lakehouse-api security:bootstrap` |
| `Authentication failed` từ MongoDB | `MONGO_URI` thiếu credentials | `mongodb://mongoadmin:mongoadmin@127.0.0.1:27017/?authSource=admin` |
| Lỗi CORS trên trình duyệt | `API_CORS_ORIGINS` thiếu `http://localhost:5173` | Thêm origin của web dev (5173, **không phải** 3000 — 3000 là Metabase) |

> 💡 **"Thêm họ làm admin" trên GitHub không có tác dụng gì với hệ thống này.**
> RBAC của Control Plane lưu trong MongoDB collection `control_plane_users`
> (`apps/api/src/modules/security/repositories/models/user.model.ts`). Mỗi máy
> có một MongoDB riêng ⇒ mỗi máy cần bootstrap riêng.

### 21.8 API báo lỗi MongoDB: `Authentication failed` hoặc `command ... requires authentication`

MongoDB trong Compose bật xác thực với user `mongoadmin`. URI trong file mẫu không có thông tin đăng nhập. Dùng:

```dotenv
MONGO_URI=mongodb://mongoadmin:mongoadmin@127.0.0.1:27017/?authSource=admin
```

Sau khi sửa `apps/api/.env.local`, restart API.

### 21.9 Job Bronze/Silver/Gold/Crawler nằm mãi ở `queued`

API chỉ nộp job; `lake-worker` mới chạy.

```bash
docker ps --filter name=lake-worker
docker logs --tail 100 lake-worker
docker exec lake-redis redis-cli ping           # kỳ vọng: PONG
```

Nếu worker không chạy: `docker compose -f docker-compose.yml -f docker-compose-kafka.yml -f docker-compose.dev-api.yml up -d worker`. Nếu bạn chạy API trên host mà không có worker nào tiêu thụ cùng hàng đợi Redis thì job cũng không bao giờ chạy.

### 21.10 Kafka không lên: `InconsistentClusterIdException`

ZooKeeper lưu cluster ID, volume dữ liệu Kafka lưu ID cũ trong `meta.properties`. Hai bên lệch khi một volume bị tạo lại. Compose dùng volume ZooKeeper có phiên bản (`zookeeper_data_v2`, `zookeeper_log_v2`) để `down` rồi `up` thường không làm lệch.

Cách an toàn: giữ nguyên cả hai volume, `docker compose … up -d` bình thường. Nếu đã lệch và chấp nhận mất toàn bộ topic/offset/message, mới xoá **cả** volume ZooKeeper lẫn Kafka cùng lúc. Không thể hoàn tác.

### 21.11 Crawler/producer: `NoBrokersAvailable`

Kafka chưa lên hoặc `KAFKA_BOOTSTRAP` sai. Từ host dùng `localhost:9092`; trong container dùng `kafka:29092`. Kiểm tra `docker ps --filter name=lake-kafka` và http://localhost:8081.

### 21.12 Web UI gọi API lỗi (404, 502, `ECONNREFUSED`)

- API chưa chạy: `curl -s localhost:3001/api/health`.
- Web trên host: Vite proxy `/api` → `API_PROXY_TARGET`. Kiểm tra `apps/web/.env`.
- `VITE_API_BASE_URL` để trống ⇒ trình duyệt gọi cùng origin. Chỉ đặt khi muốn gọi thẳng, và khi đó phải thêm origin Web vào `API_CORS_ORIGINS`.
- 401/403 sau khi bật `API_AUTH_ENABLED=true` ⇒ xem mục 24.2.

### 21.13 `next build` hoặc API trên Alpine báo thiếu DuckDB delta extension / lỗi glibc

DuckDB extension cần glibc. Image API dùng `node:20-bookworm-slim`, **không** phải Alpine. Không đổi base image.

### 21.14 `500 ENOENT /app/src/modules/gold-queries/sql/01_business_metrics.sql`

Thiếu `COPY` thư mục SQL vào image runtime. Thêm vào `apps/api/Dockerfile`:

```dockerfile
COPY --from=builder /app/src/modules/gold-queries/sql ./src/modules/gold-queries/sql
```

Rồi `docker compose -f docker-compose.yml -f docker-compose-kafka.yml -f docker-compose.dev-api.yml up -d --build api`.

### 21.15 `403 Forbidden` với `UNKNOWN_ROUTE` trên `/api/bronze`, `/api/silver`, `/api/gold`

Regex policy yêu cầu dấu `/` cuối. Sửa trong `apps/api/src/modules/security/services/policy.service.ts`:

```typescript
rule('GET', /^\/api\/bronze(?:\/|$)/, READ),
rule('GET', /^\/api\/silver(?:\/|$)/, READ),
rule('GET', /^\/api\/gold(?:\/|$)/, READ),
```

Rồi rebuild API.

### 21.16 `401` / `403 INSUFFICIENT_ROLE` / `403 OUT_OF_SCOPE`

Token hết hạn hoặc chưa gửi; role/scope của tài khoản chưa đủ cho route. Kiểm tra `policy.service.ts` và cấu hình user. **Không nới quyền toàn cục để né lỗi.**

### 21.17 `500` từ DuckDB, Mongo, Redis, Kafka

Xem `/api/health/deep`, log API và log service tương ứng.

### 21.18 Windows: script `.sh` lỗi `\r: command not found` hoặc `bad interpreter`

File shell bị đổi sang CRLF. Clone trong WSL2 (không clone ở `C:\`), và đặt `git config core.autocrlf input` trước khi clone. Sửa file đã hỏng: `dos2unix scripts/*.sh`.

### 21.19 Docker hết dung lượng đĩa

```bash
docker system df
```

Chỉ dọn thứ không cần: `docker builder prune` (cache build), `docker image prune` (image không dùng).
**Tránh** `docker system prune --volumes` và `docker volume prune` — chúng xoá dữ liệu MinIO, Mongo, Kafka.

---

## 22. Logs, giám sát & quan sát

| Việc | Lệnh |
|---|---|
| Trạng thái container | `make ps` |
| Log tất cả (core + kafka) | `make logs` |
| Log tất cả (kèm Control Plane) | `docker compose -f docker-compose.yml -f docker-compose-kafka.yml -f docker-compose.dev-api.yml logs -f` |
| Log một service | `docker logs -f --tail 100 lake-api` |
| Log worker | `docker logs -f --tail 100 lake-worker` |
| Log Airflow scheduler | `docker logs -f lake-airflow-scheduler` |
| Log Kafka | `docker logs -f lake-kafka` |
| Log Airflow task (UI) | http://localhost:8088 → DAG → Grid → chọn task → Logs |
| Log Airflow task (CLI) | `docker exec lake-airflow-webserver airflow tasks states-for-dag-run <dag_id> <run_id>` |
| Crawler scheduler | `/tmp/crawl_scheduler.log` (khi `make scheduler-daemon`) |
| OOM check | `docker inspect <container> --format '{{.State.OOMKilled}}'` |
| Tài nguyên realtime | `docker stats --no-stream` |
| Log API có cấu trúc | pino JSON ra stdout — `docker logs lake-api \| jq .` |

### 22.1 Điểm kiểm tra sức khỏe

| Kiểm tra | Lệnh | Kỳ vọng |
|---|---|---|
| API nhanh | `curl -s localhost:3001/api/health` | `{"data":{"status":"ok"}}` |
| API sâu | `curl -s localhost:3001/api/health/deep` | mọi dependency `up` |
| Web | `curl -s -o /dev/null -w '%{http_code}' localhost:5173` | `200` |
| MinIO | `curl -s localhost:9000/minio/health/live` | `200` |
| Airflow | `curl -fsS -u admin:admin localhost:8088/api/v1/health` | `200` |
| Redis | `docker exec lake-redis redis-cli ping` | `PONG` |
| Kafka topics | `docker exec lake-kafka kafka-topics --bootstrap-server kafka:29092 --list` | 7 topic |
| DAG import | `docker exec lake-airflow-webserver airflow dags list-import-errors` | `No data found` |
| Worker | `docker logs --tail 20 lake-worker` | không có lỗi kết nối Redis |

### 22.2 Theo dõi job

Job lưu trong MongoDB và cập nhật qua BullMQ.

```bash
# Trạng thái job qua API
curl -s localhost:3001/api/operations
curl -s localhost:3001/api/bronze/jobs
curl -s localhost:3001/api/silver/jobs
curl -s localhost:3001/api/gold/jobs
```

---

## 23. Dừng, khởi động lại & dọn dẹp an toàn

Phân biệt rõ 5 thao tác:

| Lệnh | Xoá container? | Xoá volume? | Xoá dữ liệu? | Khôi phục được? |
|---|---|---|---|---|
| `docker compose stop <svc>` | ✅ dừng | ❌ | ❌ | ✅ `start` |
| `docker compose down` | ✅ | ❌ | ❌ | ✅ `up -d` |
| `docker compose down -v` | ✅ | ✅ | ✅ | ❌ |
| `docker volume prune` | ❌ | ✅ | ✅ | ❌ |
| `docker system prune --volumes` | ✅ | ✅ | ✅ | ❌ |

### 23.1 Dừng

```bash
# Dừng frontend/API chạy trên host
Ctrl+C   # tại terminal tương ứng

# Dừng Control Plane (core + kafka + api + worker + web)
make down-api

# Dừng core stack (core + kafka)
make down
```

Dữ liệu nằm trong Docker volume ⇒ `down` **không** làm mất MinIO, MongoDB, Postgres, Kafka.

### 23.2 Khởi động lại

```bash
# Restart một container
docker compose -f docker-compose.yml -f docker-compose-kafka.yml restart lake-airflow-scheduler

# Rebuild + restart API
docker compose -f docker-compose.yml -f docker-compose-kafka.yml -f docker-compose.dev-api.yml up -d --build api

# Restart worker
docker compose -f docker-compose.yml -f docker-compose-kafka.yml -f docker-compose.dev-api.yml restart worker
```

Sau khi đổi `.env` hoặc `apps/api/.env.local` ⇒ **restart service nhận cấu hình**. `API_CORS_ORIGINS`, auth và backend URL thường cần restart API.

### 23.3 Dọn dẹp an toàn

```bash
make clean-pyc                              # xoá __pycache__ và .pyc
docker builder prune                        # xoá cache build
docker image prune                          # xoá image không dùng
docker system df                            # xem mức dùng đĩa
```

### 23.4 Reset toàn bộ (NGUY HIỂM)

```bash
make reset
```

Hai bước xác nhận: `yes` rồi `RESET`. Sau đó: xoá mọi Docker volume + `data-samples/*`, rồi restart stack.

Sau khi reset phải làm lại: build image → `make up-api` → tạo bucket `lakehouse` → `make mock-retail`.

> ⚠️ **`make clean` KHÔNG phải lệnh dọn nhẹ** — nó là bí danh của `make reset`. Dùng `make clean-pyc` nếu chỉ muốn dọn file tạm.

### 23.5 Vòng đời máy khởi động lại

```bash
open -a Docker
make up-api
# đợi API healthy
curl -fsS http://127.0.0.1:3001/api/health
# nếu dùng tunnel: tạo tunnel mới, build/deploy lại Pages nếu hostname đổi
```

---

## 24. Bảo mật & thực hành tốt

### 24.1 Mặc định chỉ phù hợp cho máy cá nhân

- `API_AUTH_ENABLED` mặc định là `false` ⇒ **mọi endpoint không yêu cầu đăng nhập**. Chỉ chấp nhận được khi API chỉ nghe trên máy bạn. Không mở cổng 3001 ra mạng chung hoặc Internet ở chế độ này — ai truy cập được cũng có thể chạy job, ghi Kafka, kích hoạt DAG.
- Các cổng được publish ra mọi interface (ví dụ `0.0.0.0:9001`). Trên mạng không tin cậy, bật tường lửa hoặc đổi thành `127.0.0.1:<port>:<port>` trong file Compose.
- Mật khẩu mặc định (MinIO `minioadmin`, Airflow `admin`, MongoDB `mongoadmin`, Gold PostgreSQL) chỉ dành cho dev cục bộ.

### 24.2 Bật xác thực cho API

Các biến trong `apps/api/.env.local` (định nghĩa ở `apps/api/src/config/env.ts`):

| Biến | Ý nghĩa | Mặc định |
|---|---|---|
| `API_AUTH_ENABLED` | Bật xác thực và phân quyền | `false` |
| `API_JWT_SECRET` | Khóa HMAC cho token phiên và token xác nhận, tối thiểu 32 ký tự | Giá trị dev cố định, **phải đổi** |
| `API_SESSION_TTL_SECONDS` | Thời gian sống phiên (tối thiểu 60) | `3600` |
| `API_CONFIRM_TOKEN_TTL_SECONDS` | Thời gian sống token xác nhận thao tác nguy hiểm (tối thiểu 10) | `120` |
| `API_SERVICE_KEYS` | JSON: `keyId`, `secretHash` (SHA-256 hex), `principalId`, `role`, `scopes` | rỗng |
| `API_USER_CREDENTIALS` | JSON: `principalId`, `secretHash`, `role`, `scopes` | rỗng |
| `API_BOOTSTRAP_ADMIN_EMAIL` | Email admin dùng cho script bootstrap | — |
| `API_BOOTSTRAP_ADMIN_PASSWORD` | Mật khẩu admin dùng cho script bootstrap | — |
| `API_AUDIT_ENABLED` | Ghi nhật ký kiểm toán | `true` |
| `API_RATE_LIMIT_PER_MIN` | Giới hạn yêu cầu mỗi phút | `600` |
| `API_RATE_LIMIT_FAIL_OPEN` | Khi Redis hỏng: `true` cho qua, `false` trả 503 | `true` |
| `API_CORS_ORIGINS` | Danh sách origin được phép, CSV | `http://localhost:3000` |
| `API_SWAGGER_ENABLED` | Bật Swagger UI | `true` |

Sinh khóa mạnh:

```bash
openssl rand -hex 32
```

Tạo quản trị viên đầu tiên (script đọc thông tin từ biến môi trường để mật khẩu không nằm trong lệnh hay repo; cần MongoDB đang chạy):

```bash
cd apps/api
API_BOOTSTRAP_ADMIN_EMAIL='admin@example.com' \
API_BOOTSTRAP_ADMIN_PASSWORD='<mat-khau-manh>' \
pnpm run security:bootstrap
```

Script idempotent. Đăng nhập qua `POST /api/auth/login` với JSON `{"email": "...", "password": "..."}`.
Thao tác nguy hiểm cần thêm token từ `POST /api/auth/confirm` (body `{"action": "...", "resource": "..."}`) và gửi trong header `x-confirm-token`.

### 24.3 Cloudflare Pages + Quick Tunnel

Mô hình: Web UI tĩnh trên Cloudflare Pages, API + worker + database + storage chạy trên máy cá nhân. Cloudflare Tunnel tạo kết nối đi ra từ máy bạn — không cần mở port trên router.

```mermaid
flowchart LR
    B["Trình duyệt"] --> P["Cloudflare Pages<br/>UI tĩnh"]
    P -->|"/api (URL nhúng lúc build)"| T["Cloudflare Tunnel"]
    T --> C["cloudflared<br/>trên máy cá nhân"]
    C -->|"http://127.0.0.1:3001"| A["lake-api"]
    A --> M["MongoDB"]
    A --> R["Redis + worker"]
    A --> S["MinIO hoặc R2"]
    A --> K["Kafka"]
    A --> W["Airflow / Spark"]
```

**Điều kiện bắt buộc trước khi đưa API ra ngoài:**

- Bật `API_AUTH_ENABLED=true`; đặt `API_JWT_SECRET` ngẫu nhiên ≥ 32 ký tự; cấu hình `API_CORS_ORIGINS` chính xác cho Pages production domain và (nếu dùng) preview domain.
- Bootstrap admin qua `pnpm --dir apps/api security:bootstrap`, truyền mật khẩu qua biến môi trường tương tác. Không đặt mật khẩu thật trực tiếp trong lệnh lưu vào shell history.
- Chỉ expose API `3001` qua tunnel. **Không** expose MongoDB, Redis, MinIO Console, Airflow, Kafka UI, Spark UI, Metabase hay Docker socket.
- Quick Tunnel không có SLA và hostname không ổn định. Phù hợp dev/demo có giám sát, không thay thế tunnel đặt tên, Cloudflare Access, gateway có hostname ổn định hay triển khai production.

**Build và deploy Web lên Pages.** Vite thay `VITE_API_BASE_URL` ngay trong JavaScript lúc build ⇒ URL tunnel là **cấu hình build-time**. Đổi biến ở máy sau khi deploy không tự cập nhật frontend đã phát hành.

```bash
# 1. Đăng nhập Wrangler (lần đầu hoặc khi phiên hết hạn)
npx wrangler login
npx wrangler whoami

# 2. Build frontend trong Docker (không phụ thuộc node_modules của host)
docker build \
  -f apps/web/Dockerfile \
  --build-arg VITE_API_BASE_URL=https://<hostname>.trycloudflare.com \
  --target builder \
  -t lake-web-pages-build:latest .

# 3. Lấy thư mục dist ra ngoài repo
mkdir -p /tmp/lake-web-pages-dist
container_id=$(docker create lake-web-pages-build:latest)
docker cp "$container_id":/app/apps/web/dist /tmp/lake-web-pages-dist/dist
docker rm "$container_id"

# 4. Quét artifact TRƯỚC khi deploy
rg -l --fixed-strings '<hostname>.trycloudflare.com' /tmp/lake-web-pages-dist/dist
rg -l --hidden --glob '!*.map' 'API_JWT_SECRET|DATABRICKS_TOKEN|R2_ENV_KEYS.txt' /tmp/lake-web-pages-dist/dist
```

Lệnh quét secret thứ hai **phải không trả file nào**. Nếu có kết quả ⇒ dừng deploy, kiểm tra artifact. Không đưa secret vào build args, `VITE_*`, source Web hoặc `dist`.

```bash
# 5. Deploy
npx wrangler pages deploy /tmp/lake-web-pages-dist/dist \
  --project-name=data-lake-architecture-cloude
```

Wrangler in URL deployment. Mở URL đó, kiểm tra đăng nhập và một route dữ liệu.

Nếu chỉ đổi hostname Quick Tunnel ⇒ lặp lại build → quét → deploy. Nếu dùng host build thay Docker, đặt `VITE_API_BASE_URL` trước `pnpm --dir apps/web build`, rồi deploy `apps/web/dist`.

### 24.4 Bảng chẩn đoán nhanh

| Triệu chứng | Lớp có khả năng lỗi | Kiểm tra |
|---|---|---|
| `ERR_NAME_NOT_RESOLVED`, timeout, `502`/`1033` | Quick Tunnel không chạy, sai hostname, API local chưa chạy | Terminal cloudflared, API health local, hostname trong asset JS |
| Browser báo CORS/preflight | `API_CORS_ORIGINS` thiếu origin, API chưa restart sau đổi cấu hình | So sánh Origin (scheme + host), kiểm tra response OPTIONS, restart API |
| `401` | Chưa đăng nhập, token hết hạn/không được gửi, sai thông tin đăng nhập | Đăng nhập lại; xem request có Bearer header nhưng không chia sẻ giá trị |
| `403 UNKNOWN_ROUTE` | Thiếu policy cho method + path | Thêm route policy trong `policy.service.ts`, rebuild API |
| `403 INSUFFICIENT_ROLE` / `OUT_OF_SCOPE` | Role hoặc scope tài khoản không đủ | Kiểm tra policy và cấu hình user |
| `500` + `ENOENT` | File runtime thiếu trong image | Kiểm tra `COPY` trong Dockerfile, rebuild image |
| `500` từ DuckDB/Mongo/Redis/Kafka | Dependency/backend hoặc dữ liệu/config | `/api/health/deep`, log API và log service |
| API health `200`, UI vẫn dùng API cũ | URL được bundle ở lần build trước | Xem Request URL/asset JS; build và deploy lại với hostname mới |

### 24.5 Quản lý bí mật

- `.env`, `apps/api/.env.local`, `apps/web/.env`, `R2_ENV_KEYS.txt` chứa bí mật; **không commit**. Kiểm tra trước khi commit: `git status` và `git diff --cached`.
- Không dán token Databricks, khóa R2, `METABASE_API_KEY`, `API_JWT_SECRET` vào chat, issue hay log.
- Nếu bí mật đã lộ (commit nhầm, gửi nhầm): thu hồi và tạo mới ngay — xoá khỏi lịch sử Git không đủ.
- `secretHash` trong `API_SERVICE_KEYS` là SHA-256 của bí mật, không phải bí mật thô. Giữ bí mật thô ở nơi an toàn.
- Không công khai Metabase (cổng 3000) trực tiếp. Dùng Cloudflare Tunnel kèm Access — xem `docs/METABASE_SHARING.md`.
- Trong DevTools, không copy/export HAR hoặc screenshot chứa `Authorization`, token, cookie, email cá nhân hay dữ liệu nhạy cảm.

### 24.6 Checklist trước khi chia sẻ URL Pages

- [ ] API auth bật và admin đã bootstrap; tài khoản không dùng mật khẩu mặc định/yếu.
- [ ] `API_JWT_SECRET` là secret riêng tư, mạnh, không có trong Git hoặc Web bundle.
- [ ] `API_CORS_ORIGINS` chỉ chứa origin cần thiết; không dùng wildcard cho API có credential.
- [ ] Chỉ hostname API được đưa vào `VITE_API_BASE_URL`; không đưa key R2, token Databricks hay secret server vào biến `VITE_*`.
- [ ] Tunnel đang kết nối và `/api/health` qua tunnel trả `200`.
- [ ] Frontend artifact đã quét secret trước khi deploy; `R2_ENV_KEYS.txt` không được upload/commit.
- [ ] API/worker chỉ expose các port cần thiết; không tunnel dashboard/database nội bộ.
- [ ] Hiểu rằng Quick Tunnel có thể đổi URL và dừng bất cứ lúc nào.

### 24.7 Giới hạn của tài liệu này

Đã đọc cấu hình và mã xác thực, nhưng **không** chạy kiểm thử thâm nhập hay rà soát bảo mật toàn diện. Trước khi đưa hệ thống ra ngoài máy cá nhân, cần một lượt rà soát bảo mật riêng.

---

## 25. Quy trình phát triển & Git

### 25.1 Nhánh trong repo

| Nhánh | HEAD | Ghi chú |
|---|---|---|
| `main` | `16a0f05` | Nhánh phát hành, `origin/HEAD` trỏ tới đây; **ahead `origin/main` 4 commit** |
| `dev` | `79bb2aa` | Nhánh phát triển |
| `dev-v2` | `49b2302` | Đã merge vào `main` qua `ff0b7bb` |
| `dev-v3` | `1feadc1` | Đã merge (fast-forward) vào `main` |
| `dev-v4` | `28e39a7` | **Đã merge (fast-forward) vào `main`** — xem mục 03 |
| `feat/spark-arm64-and-docs` | `bbf3e49` | Có 3 commit chưa push; đã merge vào `main` qua `ff0b7bb` |

### 25.2 Luồng công việc

```bash
# Lấy code mới
git checkout main
git pull

# Tạo nhánh làm việc
git checkout -b feature/ten-tinh-nang

# Làm việc, kiểm tra trước khi commit
git status
git diff
make check                    # ruff + black --check + pytest
pnpm --filter lakehouse-api typecheck && pnpm --filter lakehouse-api test

# Commit
git add <file cụ thể>          # KHÔNG git add -A (dễ lôi nhầm file env)
git diff --cached              # kiểm tra kỹ trước khi commit
git commit -m "feat: mô tả thay đổi"

# Đẩy nhánh và tạo PR
git push -u origin feature/ten-tinh-nang
gh pr create --base main --title "..." --body "..."
```

> ⚠️ **Luôn kiểm tra `git diff --cached` trước khi commit.** `.env`, `apps/api/.env.local`, `R2_ENV_KEYS.txt` đã bị `.gitignore` — nhưng `git add -A` có thể lôi file mới chứa bí mật nếu pattern chưa được thêm.

### 25.3 Quy tắc commit

Repo dùng Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `build:`, `ci:`.

### 25.4 CI gate

Push hoặc PR lên `main` ⇒ chạy `.github/workflows/ci.yml` (4 job, xem mục 20.4). Tất cả job phải xanh trước khi merge.

### 25.5 Deploy

Frontend được deploy lên Cloudflare Pages qua **Cloudflare Pages Git integration** (workflow GitHub Actions deploy đã bị gỡ ở commit `715c6a1`). Deploy tự động khi push lên nhánh được cấu hình.

---

## 26. Trạng thái kiểm chứng & giới hạn

### 26.1 Đã kiểm chứng trong phiên audit này

| Hạng mục | Phương pháp | Kết quả |
|---|---|---|
| Git state & `dev-v4` → `main` | `git merge-base --is-ancestor`, `git log --graph` | Fast-forward, `28e39a7` là ancestor của HEAD `16a0f05`; 4 commit sửa lỗi đã commit, chưa push |
| Cấu trúc repository | `find`, `ls`, đọc source | 3 app, 37 file trong `scripts/`, 21 test Python, 27 test API (`apps/api/tests/`), 20 test Web, 131 route |
| Compose config | `docker compose config --services` (cả 3 tổ hợp) | 16 / 19 service hợp lệ |
| Makefile targets | Đối chiếu từng target README viện dẫn | Tất cả tồn tại (`demo`, `experiment-01..03`, `airflow-trigger`, `databricks-*`, `spark-shell`, `clean-pyc`, `verify`) |
| Script được viện dẫn | Kiểm tra file tồn tại | 42/42 file tài liệu tham khảo tồn tại |
| Health endpoints | `curl` | API 200; API deep 200 — 6/7 service `up`, Databricks `degraded` (warehouse `STOPPED`, không có workspace thật) |
| Container state | `docker ps -a` | 13 `lake-*` running (12 `healthy`, `lake-worker` không có healthcheck), 6 exited: `spark-master`/`spark-worker`/`metabase` OOM-kill (137), `kafka-init`/`minio-init` hoàn tất (0), `kafka-ui` bị dừng (143) |
| Dữ liệu lake | `mc ls --recursive local/lakehouse/` | 780 object, có `_delta_log`, parquet, checkpoint |
| Kafka topics | `kafka-topics --list` | Đúng 7 topic |
| Airflow DAG | `airflow dags list`, `list-import-errors` | 4 DAG, `paused=False`, không import error |
| Gold mirror | `psql \dt` | 4 bảng trong `gold_analytics.public` |
| Biến môi trường R2 | `rg` trên `src/lakehouse` + `apps/api/src/config/env.ts` | Xác định 3 bộ tên, chỉ `S3_*` là bộ thật |
| Chính sách bảo mật | Đọc `policy.service.ts` | 60+ rule, 4 vai trò, 6+ scope |

### 26.2 `DOCUMENTED BUT UNTESTED`

| Hạng mục | Vì sao chưa kiểm chứng |
|---|---|
| Cloudflare R2 (ghi/đọc thật) | Không có bucket R2 thật nào được đụng tới — tránh phát sinh chi phí/thay đổi cloud state |
| `scripts/test_r2_connection.sh` | Script in 8 ký tự đầu access key — không chạy để tránh lộ bí mật vào log phiên audit |
| Cloudflare Pages deploy | Lệnh đã xác minh theo source (`apps/web/Dockerfile` có `ARG VITE_API_BASE_URL`), nhưng không deploy trong phiên audit |
| Databricks | Không có workspace thật. `databricks-dryrun` / `databricks-diag` / `databricks-bootstrap` chỉ được đọc |
| Windows / Linux native | Không có máy đó để chạy. Riêng phần quyền Docker socket cho Airflow trên Linux được đánh dấu rõ |
| `Dockerfile.airflow` trên x86_64 | Chỉ đối chiếu checksum, chưa build |
| `make demo`, `make experiment-01..03` | Target tồn tại, cần Java 17 + venv; không chạy trong phiên audit |
| `make verify-r2` | Yêu cầu R2 thật |
| Luồng đăng nhập end-to-end của Web UI | `LoginView` đã commit trong `7b63257` nhưng luồng chưa được kiểm thử qua trình duyệt |

### 26.3 Vấn đề source/config phương ánh (không tự sửa)

Theo yêu cầu nhiệm vụ, các vấn đề dưới đây được **ghi nhận** chứ không tự sửa:

| # | Vấn đề | Vị trí | Tác động | Mức độ |
|---|---|---|---|---|
| 1 | `.env.example` dùng `R2_ENDPOINT_URL`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_BUCKET` — không module nào đọc | `.env.example:31-34` | Người dùng điền theo mẫu ⇒ hệ thống vẫn dùng MinIO, R2 "có vẻ" cấu hình nhưng không hoạt động | **Cao** |
| 2 | `.env.example` đặt `AIRFLOW_BASE_URL=http://localhost:8080/api/v1` — 8080 là Spark UI | `.env.example:52` | API trên host gọi nhầm Spark UI | Cao |
| 3 | `minio-init` không tạo bucket `lakehouse` dù toàn bộ code ghi vào đó | `docker-compose.yml` (service `minio-init`) | `NoSuchBucket` khi chạy pipeline trên máy mới | Cao |
| 4 | `scripts/dev-api.sh` và `scripts/dev-web.sh` tính `REPO_ROOT="$SCRIPT_DIR/../.."` → ra ngoài repo | `scripts/dev-api.sh`, `scripts/dev-web.sh` | Script không chạy được | Trung bình |
| 5 | `quickstart.sh:64` tham chiếu `docker-compose.spark.yml` — file không tồn tại | `quickstart.sh` | Script fail giữa chừng | Trung bình |
| 6 | `make mock-stream` gọi `lakehouse.sources.mock.generic_generator` — module không tồn tại (`mock/` chỉ có `retail_generator.py`) | `Makefile` | Target fail | Trung bình |
| 7 | Comment `make scheduler` ghi "all 11 jobs" — thực tế 8 job | `Makefile` | Ghi chú sai | Thấp |
| 8 | `make pipeline-silver` / `make pipeline-gold` chỉ truyền gói `delta-spark`, thiếu `hadoop-aws` + `aws-java-sdk-bundle` | `Makefile` | Lỗi khi đọc/ghi S3 | Trung bình |
| 9 | `docs/operations/DATA_LAYOUT.md` mô tả layout `s3a://bronze/…` (mỗi layer một bucket) — code dùng `s3a://lakehouse/{layer}/…` | `docs/operations/DATA_LAYOUT.md` | Đọc tài liệu này sẽ tìm nhầm đường dẫn | Trung bình |
| 10 | `docker-compose.api.yml.deprecated` còn trong repo | repo root | Gây rối; `scripts/verify.sh` cảnh báo nếu file `docker-compose.api.yml` tồn tại | Thấp |
| 11 | CI chỉ validate `core + kafka`, không validate overlay `dev-api` | `.github/workflows/ci.yml` | Lỗi trong `docker-compose.dev-api.yml` không bị chặn ở PR | Thấp |
| 12 | `lake-worker` không có healthcheck | `docker-compose.dev-api.yml` | Hiển thị `Up` thay vì `healthy` — dễ gây nhầm là worker chết | Thấp |
| 13 | `Dockerfile.airflow` cố định JDK `aarch64` | `Dockerfile.airflow` | Image hỏng trên x86_64 (đã có hướng dẫn ở mục 13.4) | Trung bình |

### 26.4 Hạn chế của README này

- Đã đọc cấu hình, mã nguồn và kiểm tra runtime read-only. **Không** chạy kiểm thử thâm nhập, rà soát bảo mật toàn diện, build lại toàn bộ Docker stack, xoá dataset, trigger pipeline production, hay bulk upload/delete trên R2.
- Đội hình máy tham chiếu: Docker 29.7.2, Compose v5.4.0, 8 CPU / ~7,75 GiB RAM, `aarch64`.
- Số liệu "đã kiểm chứng" trong README là ảnh chụp trạng thái tại thời điểm audit. Trạng thái stack có thể khác trên máy bạn.

---

## 27. Tài liệu tham khảo & bảo trì

### 27.1 Tài liệu trong repo

Tất cả đường dẫn dưới đây đã được kiểm tra tồn tại.

| Chủ đề | File |
|---|---|
| Khởi động nhanh | `docs/operations/quickstart.md` |
| Biến môi trường | `docs/operations/environment.md` |
| Docker | `docs/operations/docker.md` |
| Kiểm thử | `docs/operations/testing.md` |
| CI/CD | `docs/operations/ci-cd.md` |
| Runbook E2E | `docs/operations/E2E_RUNBOOK.md` |
| Liên kết dev | `docs/operations/DEV_LINKS.md` |
| Bố cục dữ liệu | `docs/operations/DATA_LAYOUT.md` (⚠️ xem mục 26.3 #9), `docs/handbook/DATA_LAYOUT.md` |
| Databricks | `docs/operations/DATABRICKS_SETUP.md`, `docs/operations/DATABRICKS_BRIDGE_PY314.md`, `docs/operations/DATABRICKS_HOST_PROBE.md`, `docs/operations/DATABRICKS_LIVE_INVENTORY.md` |
| Cloudflare R2 | `docs/operations/R2_SETUP.md`, `docs/cloud/r2/SETUP.md`, `docs/cloud/r2/SPARK_CONFIG.md` |
| R2 lifecycle | `infra/r2/README.md`, `infra/r2/lifecycle-bronze.json`, `infra/r2/lifecycle-silver.json`, `infra/r2/lifecycle-gold.json` |
| Kiến trúc | `docs/architecture/ARCHITECTURE.md`, `docs/architecture/overview.md`, `docs/architecture/layers.md`, `docs/architecture/medallion.md`, `docs/architecture/STREAMING_SEMANTICS.md`, `docs/architecture/cqrs-events.md` |
| API | `docs/handbook/API.md`, `docs/api/endpoints.md`, `docs/api/entities.md`, `docs/api/schemas.md`, `apps/api/README.md`, `apps/api/ARCHITECTURE.md` |
| Tích hợp UI ↔ API | `UI_API_INTEGRATION.md`, `docs/UI_API_INTEGRATION.md` |
| Giao diện | `docs/handbook/UI_GUIDE.md`, `docs/handbook/TOOLS.md` |
| ETL vs ELT | `docs/handbook/ETL_VS_ELT.md` |
| Chia sẻ Metabase | `docs/METABASE_SHARING.md` |
| Mapping dịch vụ cloud | `docs/cloud/SERVICE_MAPPING.md` |
| Restart tunnel R2 local | `docs/operations/RESTART_LOCAL_R2_TUNNEL.md` |
| Kế hoạch Control Plane / EDA / DQ | `docs/DATA_LAKEHOUSE_INTERACTIVE_CONTROL_PLANE_EDA_DQ_MASTER_PLAN_2026-10-24.md` |
| Tình trạng dự án | `docs/PROJECT_STATUS_AND_REMAINING_WORK.md` |

### 27.2 Quy tắc bảo trì README

1. **Mọi lệnh phải có nguồn.** Trước khi thêm lệnh, xác nhận nó tồn tại trong `Makefile`, `package.json`, `scripts/` hoặc Compose. Không suy đoán.
2. **Mọi biến môi trường phải được code đọc.** Kiểm tra bằng `rg 'get_env\("' src/lakehouse` và `rg 'env\.' apps/api/src`. Biến chỉ có trong `.env.example` mà không có trong code là placeholder.
3. **Mọi cổng phải khớp Compose.** `docker compose config` là nguồn sự thật.
4. **Cập nhật mục 03 khi có merge mới.** Chạy `git merge-base --is-ancestor <nhánh> main` để xác nhận, rồi `git log --oneline <nhánh>..main`.
5. **Cập nhật mục 26 khi kiểm chứng thêm.** Giữ ranh giới giữa "đã kiểm chứng" và "chỉ có trong tài liệu" rõ ràng.
6. **Không đưa bí mật vào README.** Chỉ tên biến, mục đích, và giá trị ví dụ đã ẩn danh.
7. **Mục 26.3 là danh sách nợ.** Khi sửa một vấn đề ở đó, cập nhật trạng thái trong bảng thay vì xoá dòng.

### 27.3 Nguồn sự thật

| Cần biết | Hãy đọc |
|---|---|
| Đường dẫn dataset | `src/lakehouse/core/paths.py`, `src/lakehouse/core/datasets.py` |
| Cấu hình Spark/S3A | `src/lakehouse/core/spark.py` |
| Quy tắc biến môi trường | `src/lakehouse/core/env.py`, `apps/api/env-loader.js` |
| Danh sách service | `docker-compose.yml`, `docker-compose-kafka.yml`, `docker-compose.dev-api.yml` |
| Lệnh vận hành | `Makefile` (`make help`) |
| Quyền theo route | `apps/api/src/modules/security/services/policy.service.ts` |
| Route API | `apps/api/src/app/api/**/route.ts` |
| Màn hình Web | `apps/web/src/App.tsx`, `apps/web/src/navigation/routes.ts` |
| DAG | `airflow_dags/*.py` |
| Job protocol | `src/lakehouse/jobs/protocol.py`, `src/lakehouse/jobs/runner.py` |

---

<div align="center">

**DATA LAKE ARCHITECTURE** — Control Plane cho Data Lakehouse Medallion

Nhánh `main` · commit `16a0f05` · `dev-v4` đã tích hợp (fast-forward, `28e39a7`)

</div>
