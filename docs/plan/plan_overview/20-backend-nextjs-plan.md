# Plan: Backend API cho Data Lake — Next.js 15 + TypeScript

> **Tác giả:** Main Agent (Cursor IDE AI) — data-lake-architecture-claude coordinator
> **Ngày:** 2026-10-06
> **Phiên bản:** v1.0 (chờ sếp review)
> **Phạm vi:** Backend-only cho toàn bộ data lake (Bronze / Silver / Gold / Crawler / Kafka / Airflow / DQ / Catalog)

---

## 0. Tóm tắt điều hành

| Mục | Quyết định |
|-----|------------|
| Ngôn ngữ | TypeScript 5.x (strict mode) |
| Framework | Next.js 15+ App Router, Route Handlers, `runtime = 'nodejs'` |
| Kiến trúc | Monorepo style (BE-only) — `app/` + `src/modules/` + `src/lib/` |
| Pattern | 4 lớp rõ ràng: **Route → Controller → Service → Repository** |
| OpenAPI/Swagger | `next-swagger-doc` + `swagger-ui-react`, tự động scan JSDoc |
| Data Lake query | DuckDB Node.js (`@duckdb/node-api`) + extension `delta` + `httpfs`, đọc trực tiếp Parquet/Delta từ MinIO |
| NoSQL (metadata + log + cache) | MongoDB + Mongoose (connection cache theo pattern Next.js) |
| Validation runtime | Zod (cũng là source of truth cho OpenAPI schemas) |
| Logger | Pino + request-id |
| Background jobs | BullMQ + Redis (cho ingest/transform/aggregate dài hơi) |
| Auth | **KHÔNG CÓ** (theo yêu cầu sếp) — open access local |
| Container hóa | Thêm `mongo`, `redis`, `api` vào `docker-compose.yml` |

**Tổng số endpoint dự kiến: 110+ REST endpoints, phân bổ cho 8 nhóm nghiệp vụ.**

---

## 1. Cấu trúc thư mục (Monorepo BE style)

```
data-lake-architure-cloude/
├── apps/
│   └── api/                                # Next.js BE (độc lập, có thể chạy riêng)
│       ├── src/
│       │   ├── app/                        # App Router — HTTP layer mỏng
│       │   │   ├── layout.tsx
│       │   │   ├── page.tsx                # Landing (link tới /api-doc, /health)
│       │   │   ├── api-doc/                # Swagger UI
│       │   │   │   ├── page.tsx
│       │   │   │   └── SwaggerUIClient.tsx
│       │   │   └── api/
│       │   │       ├── docs/openapi.json/route.ts
│       │   │       ├── health/route.ts
│       │   │       ├── bronze/...          # xem §4.1
│       │   │       ├── silver/...          # xem §4.2
│       │   │       ├── gold/...            # xem §4.3
│       │   │       ├── crawler/...         # xem §4.4
│       │   │       ├── kafka/...           # xem §4.5
│       │   │       ├── airflow/...         # xem §4.6
│       │   │       ├── dq/...              # xem §4.7
│       │   │       └── catalog/...         # xem §4.8
│       │   │
│       │   ├── modules/                    # Feature modules (domain)
│       │   │   ├── bronze/
│       │   │   │   ├── controllers/bronze.controller.ts
│       │   │   │   ├── services/bronze.service.ts
│       │   │   │   ├── repositories/bronze.repository.ts     # DuckDB query Delta
│       │   │   │   ├── schemas/bronze.schema.ts              # Zod
│       │   │   │   ├── types/bronze.types.ts
│       │   │   │   ├── jobs/bronze.ingest.job.ts             # BullMQ worker
│       │   │   │   └── index.ts                              # Public API
│       │   │   ├── silver/  (cùng cấu trúc)
│       │   │   ├── gold/    (cùng cấu trúc)
│       │   │   ├── crawler/ (cùng cấu trúc + thêm adapters/)
│       │   │   ├── kafka/   (cùng cấu trúc + producers/, consumers/)
│       │   │   ├── airflow/ (cùng cấu trúc)
│       │   │   ├── dq/      (cùng cấu trúc)
│       │   │   └── catalog/ (cùng cấu trúc)
│       │   │
│       │   ├── lib/                        # Cross-cutting infra
│       │   │   ├── infra/
│       │   │   │   ├── duckdb/client.ts    # Singleton instance
│       │   │   │   ├── mongo/client.ts     # Mongoose với global cache
│       │   │   │   ├── redis/client.ts     # ioredis singleton
│       │   │   │   ├── s3/client.ts        # @aws-sdk/client-s3 (path-style MinIO)
│       │   │   │   ├── kafka/admin.ts      # kafkajs admin
│       │   │   │   ├── kafka/producer.ts
│       │   │   │   └── airflow/client.ts   # fetch wrapper cho Airflow REST
│       │   │   ├── http/
│       │   │   │   ├── http-client.ts
│       │   │   │   ├── error-handler.ts
│       │   │   │   └── response-builder.ts
│       │   │   ├── jobs/queue.ts           # BullMQ wrapper
│       │   │   ├── logger/pino.ts
│       │   │   └── utils/                  # date, csv, json helpers
│       │   │
│       │   ├── config/
│       │   │   ├── env.ts                  # Zod validation cho env
│       │   │   └── constants.ts
│       │   │
│       │   ├── middlewares/                # HOF composable
│       │   │   ├── with-request-id.ts
│       │   │   ├── with-error-handler.ts
│       │   │   ├── with-rate-limit.ts      # Redis-based
│       │   │   └── with-cors.ts
│       │   │
│       │   ├── errors/
│       │   │   ├── AppError.ts
│       │   │   ├── NotFoundError.ts
│       │   │   ├── ConflictError.ts
│       │   │   └── ValidationError.ts
│       │   │
│       │   └── types/api.types.ts
│       │
│       ├── proxy.ts                        # Next.js edge middleware (logging)
│       ├── next.config.ts                  # serverExternalPackages: ['@duckdb/node-api', 'mongoose']
│       ├── tsconfig.json                   # strict, paths alias
│       ├── package.json
│       ├── Dockerfile
│       └── .env.local                      # gitignored
│
├── packages/                               # Shared local packages (optional cho giai đoạn sau)
│   ├── contracts/                          # Shared Zod schemas giữa FE/BE
│   └── tsconfig/
│
├── docker-compose.api.yml                  # Compose riêng cho BE stack
├── turbo.json                              # nếu dùng Turborepo
└── (giữ nguyên src/lakehouse/, airflow_dags/, sql/, scripts/)
```

### Quy tắc phân lớp (BẮT BUỘC)

| Layer | Biết gì | Không biết gì | Vị trí |
|-------|---------|---------------|--------|
| **Route** | HTTP method, Request, Response, status code | Business rules, DB | `app/api/**/route.ts` |
| **Controller** | Parse input (Zod), gọi service, format response | SQL/DuckDB, ORM | `modules/*/controllers/` |
| **Service** | Business rules, orchestration, transaction | HTTP, ORM cụ thể | `modules/*/services/` |
| **Repository** | DuckDB/Mongo query, connection | Business rules, HTTP | `modules/*/repositories/` |

> **Quy tắc vàng:** DuckDB query chỉ trong Repository. Business logic chỉ ở Service.

---

## 2. Tech stack chi tiết & dependencies

### 2.1. Runtime

| Package | Version | Mục đích |
|---------|---------|----------|
| `next` | 15.x | Framework |
| `react`, `react-dom` | 19.x | Cho Swagger UI client component |
| `typescript` | 5.5+ | Ngôn ngữ |

### 2.2. Data layer

| Package | Version | Mục đích |
|---------|---------|----------|
| `@duckdb/node-api` | ≥ 1.4 | Query Delta Lake trên MinIO (extensions: `delta`, `httpfs`) |
| `mongoose` | 9.x | MongoDB ODM (NoSQL) |
| `ioredis` | 5.x | Redis client (cache + BullMQ) |

### 2.3. Integration

| Package | Version | Mục đích |
|---------|---------|----------|
| `kafkajs` | 2.x | Kafka admin + producer (Redpanda compatible) |
| `@aws-sdk/client-s3` | 3.x | MinIO S3 client |
| `node-fetch` (hoặc native) | 2.x | Airflow REST proxy |

### 2.4. Validation & API

| Package | Version | Mục đích |
|---------|---------|----------|
| `zod` | 3.x | Runtime validation + OpenAPI schema |
| `next-swagger-doc` | latest | JSDoc → OpenAPI 3.0 spec |
| `swagger-ui-react` | 5.x | UI hiển thị spec |

### 2.5. Jobs & Logging

| Package | Version | Mục đích |
|---------|---------|----------|
| `bullmq` | 5.x | Background job queue (trigger pipeline dài) |
| `pino` | 9.x | Structured logger |
| `pino-http` | latest | Request logger |

### 2.6. Dev

| Package | Version | Mục đích |
|---------|---------|----------|
| `@types/node`, `@types/react` | latest | Types |
| `eslint`, `prettier` | latest | Lint/format |
| `tsx` | 4.x | Dev runner |
| `vitest` | 2.x | Unit test (NHƯNG sếp nói "quản lý đơn giản" → test optional) |

---

## 3. Convention đặt tên (theo working_rule.md)

| Loại | Convention | Ví dụ |
|------|-----------|-------|
| Folder module | `kebab-case` | `bronze/`, `crawler-config/` |
| File TypeScript | `kebab-case.ts` | `bronze.controller.ts` |
| Class | `PascalCase` | `BronzeService`, `CrawlerRepository` |
| Function/Variable | `camelCase` | `getDeltaTable`, `tableName` |
| Constant | `UPPER_SNAKE_CASE` | `MAX_PAGE_SIZE`, `DEFAULT_TIMEOUT` |
| Type/Interface | `PascalCase` | `BronzeTable`, `CrawlerConfigDto` |
| Enum | `EPascalCase` (key), `UPPERCASE` (value) | `ELayer.BRONZE` |
| Env key | `UPPER_SNAKE_CASE` | `MINIO_ENDPOINT` |
| API path | `kebab-case` | `/api/gold/fact-orders` |

---

## 4. Thiết kế Endpoints — 8 nhóm nghiệp vụ

> Quy ước CRUD: **L** = List, **R** = Read/Get, **C** = Create, **U** = Update, **D** = Delete.
> Mỗi action là 1 endpoint riêng. Verb chính xác (GET/POST/PUT/PATCH/DELETE).
> Mỗi nhóm có **resource chính** + **sub-resources** để quản lý chi tiết.

### 4.1. 🥉 Nhóm BRONZE (raw data layer)

> **Nguồn:** `s3a://bronze/{crm|erp|clickstream|ecommerce|tiki|github|crypto|weather|hackernews}/...`
> **Repository gốc:** `src/lakehouse/ingest/batch/{csv,json}_ingestor.py`, `src/lakehouse/ingest/streaming/*`

| # | Method | Path | Mô tả |
|---|--------|------|-------|
| 1 | GET | `/api/bronze` | List toàn bộ Bronze tables (group theo prefix) |
| 2 | GET | `/api/bronze/{table}` | L (R) Metadata + schema + partition list của 1 table |
| 3 | GET | `/api/bronze/{table}/sample` | R 100 dòng mẫu (preview) |
| 4 | GET | `/api/bronze/{table}/partitions` | L Danh sách partition dates |
| 5 | GET | `/api/bronze/{table}/history` | L Delta log history (audit) |
| 6 | GET | `/api/bronze/{table}/stats` | R row count, file count, size, last_modified |
| 7 | POST | `/api/bronze/ingest/csv` | C Trigger CSV ingest (multipart upload hoặc path) |
| 8 | POST | `/api/bronze/ingest/json` | C Trigger JSON ingest |
| 9 | POST | `/api/bronze/ingest/stream/{topic}` | C Trigger streaming ingest từ Kafka topic |
| 10 | GET | `/api/bronze/jobs` | L Danh sách ingest jobs (queued/running/done/failed) |
| 11 | GET | `/api/bronze/jobs/{jobId}` | R Status chi tiết 1 job |
| 12 | DELETE | `/api/bronze/jobs/{jobId}` | D Cancel 1 job |
| 13 | DELETE | `/api/bronze/{table}/partitions/{date}` | D Xoá 1 partition (vacuum) |
| 14 | POST | `/api/bronze/{table}/vacuum` | C Chạy Delta VACUUM (retention 7 ngày) |

### 4.2. 🥈 Nhóm SILVER (cleaned/validated layer)

> **Nguồn:** `s3a://silver/{customers,products,orders,clickstream,ecommerce,reviews}/...`
> **Repository gốc:** `src/lakehouse/transform/batch/*`, `src/lakehouse/transform/streaming/*`

| # | Method | Path | Mô tả |
|---|--------|------|-------|
| 15 | GET | `/api/silver` | L Tất cả Silver tables |
| 16 | GET | `/api/silver/{table}` | R Schema + metadata |
| 17 | GET | `/api/silver/{table}/sample` | R 100 dòng mẫu |
| 18 | GET | `/api/silver/{table}/partitions` | L Partition dates |
| 19 | GET | `/api/silver/{table}/history` | L Delta log history |
| 20 | GET | `/api/silver/{table}/stats` | R row count, null counts, distinct counts |
| 21 | POST | `/api/silver/{table}/transform` | C Trigger transform Bronze → Silver cho 1 table |
| 22 | POST | `/api/silver/transform/all` | C Trigger toàn bộ Silver transforms (parallel) |
| 23 | GET | `/api/silver/jobs` | L Transform jobs |
| 24 | GET | `/api/silver/jobs/{jobId}` | R Job status |
| 25 | DELETE | `/api/silver/jobs/{jobId}` | D Cancel job |
| 26 | GET | `/api/silver/{table}/time-travel/{version}` | R Data tại 1 Delta version cụ thể |
| 27 | GET | `/api/silver/{table}/diff/{v1}/{v2}` | R Diff giữa 2 version |
| 28 | POST | `/api/silver/{table}/refresh` | C Drop + rebuild từ Bronze |

### 4.3. 🥇 Nhóm GOLD (business KPI layer)

> **Nguồn:** `s3a://gold/{fact_orders, dim_customers, dim_products, daily_revenue, clickstream/*, ecommerce/*, category_analytics/*}/...`
> **Repository gốc:** `src/lakehouse/aggregate/batch/*`, `src/lakehouse/aggregate/streaming/*`
> **SQL queries có sẵn:** `sql/01_business_metrics.sql`, `02_customer_analytics.sql`, `03_product_performance.sql`, `04_category_revenue.sql`

| # | Method | Path | Mô tả |
|---|--------|------|-------|
| 29 | GET | `/api/gold` | L Tất cả Gold tables (facts + dims + metrics) |
| 30 | GET | `/api/gold/{table}` | R Schema + metadata + last refresh |
| 31 | GET | `/api/gold/{table}/sample` | R 100 dòng mẫu |
| 32 | GET | `/api/gold/{table}/history` | L Delta history |
| 33 | GET | `/api/gold/{table}/stats` | R row count, size, last_refresh_at |
| 34 | POST | `/api/gold/{table}/aggregate` | C Trigger aggregate Silver → Gold |
| 35 | POST | `/api/gold/aggregate/all` | C Trigger toàn bộ Gold aggregates |
| 36 | GET | `/api/gold/jobs` | L Aggregate jobs |
| 37 | GET | `/api/gold/jobs/{jobId}` | R Job status |
| 38 | DELETE | `/api/gold/jobs/{jobId}` | D Cancel job |
| 39 | GET | `/api/gold/queries/business-metrics` | R Kết quả 4 query trong `01_business_metrics.sql` (parameter: `days`, `limit`) |
| 40 | GET | `/api/gold/queries/customer-analytics` | R Kết quả `02_customer_analytics.sql` (parameter: `segment`) |
| 41 | GET | `/api/gold/queries/product-performance` | R Kết quả `03_product_performance.sql` (parameter: `category`, `days`) |
| 42 | GET | `/api/gold/queries/category-revenue` | R Kết quả `04_category_revenue.sql` (parameter: `parent_category`, `limit`) |
| 43 | GET | `/api/gold/queries/ad-hoc` | R Custom SQL (chỉ SELECT, có row limit 10000, chặn write) |
| 44 | POST | `/api/gold/{table}/refresh` | C Drop + rebuild từ Silver |
| 45 | GET | `/api/gold/{table}/lineage` | R Lineage graph (parents + children) |

### 4.4. 🕷️ Nhóm CRAWLER (5 crawlers)

> **Repository gốc:** `src/lakehouse/sources/crawlers/{base,tiki,github,crypto,weather,hackernews}.py`

| # | Method | Path | Mô tả |
|---|--------|------|-------|
| 46 | GET | `/api/crawler` | L Tất cả crawler (tiki, github, crypto, weather, hackernews) |
| 47 | GET | `/api/crawler/{name}` | R Metadata + config + last run stats |
| 48 | POST | `/api/crawler/{name}/run` | C Trigger 1 lần crawl (body: category, max_pages, language, since) |
| 49 | POST | `/api/crawler/{name}/run-async` | C Trigger async (trả jobId ngay, BullMQ xử lý nền) |
| 50 | POST | `/api/crawler/{name}/stop` | C Dừng crawl đang chạy |
| 51 | GET | `/api/crawler/{name}/runs` | L Lịch sử các lần crawl (lưu MongoDB) |
| 52 | GET | `/api/crawler/{name}/runs/{runId}` | R Chi tiết 1 run (stats + items + errors) |
| 53 | GET | `/api/crawler/{name}/runs/{runId}/items` | L Items crawl được (filter: success/failed) |
| 54 | GET | `/api/crawler/{name}/config` | R Cấu hình hiện tại (rate_limit, timeout, workers) |
| 55 | PUT | `/api/crawler/{name}/config` | U Cập nhật config (lưu Mongo) |
| 56 | GET | `/api/crawler/{name}/kafka-topic` | R Topic Kafka mà crawler push tới |
| 57 | GET | `/api/crawler/{name}/preview` | R Chạy thử 1 page để preview (dry-run) |
| 58 | GET | `/api/crawler/stats` | R Tổng hợp stats (total success/failed/skipped theo từng crawler) |

### 4.5. 📨 Nhóm KAFKA (9 topics + admin)

> **Topics:** `clickstream-events`, `ecommerce-products-stream`, `ecommerce-reviews-stream`, `ecommerce-price-stream`, `github-trending-stream`, `crypto-prices-stream`, `weather-stream`, `hackernews-stream`, `tiki-category-stream`

| # | Method | Path | Mô tả |
|---|--------|------|-------|
| 59 | GET | `/api/kafka/topics` | L Tất cả topics (name, partitions, replication, retention) |
| 60 | GET | `/api/kafka/topics/{topic}` | R Metadata chi tiết 1 topic |
| 61 | POST | `/api/kafka/topics` | C Tạo topic mới (partitions, replication, retention) |
| 62 | DELETE | `/api/kafka/topics/{topic}` | D Xoá topic |
| 63 | GET | `/api/kafka/topics/{topic}/messages` | L Sample N messages mới nhất (peek) |
| 64 | POST | `/api/kafka/topics/{topic}/produce` | C Produce 1 message (body: key, value, headers) |
| 65 | POST | `/api/kafka/topics/{topic}/produce-batch` | C Produce nhiều messages |
| 66 | GET | `/api/kafka/consumer-groups` | L Tất cả consumer groups |
| 67 | GET | `/api/kafka/consumer-groups/{groupId}` | R Detail 1 group (lag, members, state) |
| 68 | DELETE | `/api/kafka/consumer-groups/{groupId}` | D Xoá group |
| 69 | GET | `/api/kafka/consumer-groups/{groupId}/lag` | R Lag per partition |
| 70 | POST | `/api/kafka/consumer-groups/{groupId}/reset` | C Reset offset (earliest/latest/specific) |
| 71 | GET | `/api/kafka/cluster/info` | R Cluster info (brokers, controller) |
| 72 | GET | `/api/kafka/stats` | R Tổng hợp (total messages in/out, lag) |

### 4.6. ✈️ Nhóm AIRFLOW (3 DAGs + admin)

> **DAGs:** `retail_elt_dag` (24h, 10 tasks), `clickstream_streaming_dag` (1h, 1 task), `ecommerce_streaming_dag` (1h, 1 task)

| # | Method | Path | Mô tả |
|---|--------|------|-------|
| 73 | GET | `/api/airflow/dags` | L Tất cả DAGs (id, schedule, paused, tags) |
| 74 | GET | `/api/airflow/dags/{dagId}` | R Chi tiết DAG (tasks, schedule, params) |
| 75 | POST | `/api/airflow/dags/{dagId}/trigger` | C Trigger 1 DAG run (body: conf) |
| 76 | POST | `/api/airflow/dags/{dagId}/pause` | C Pause DAG |
| 77 | POST | `/api/airflow/dags/{dagId}/unpause` | C Unpause DAG |
| 78 | GET | `/api/airflow/dags/{dagId}/runs` | L Lịch sử DAG runs (filter: state, date) |
| 79 | GET | `/api/airflow/dags/{dagId}/runs/{runId}` | R Chi tiết 1 run |
| 80 | DELETE | `/api/airflow/dags/{dagId}/runs/{runId}` | D Xoá 1 run |
| 81 | GET | `/api/airflow/dags/{dagId}/runs/{runId}/tasks` | L Tasks trong run |
| 82 | GET | `/api/airflow/dags/{dagId}/runs/{runId}/tasks/{taskId}/logs` | R Log của 1 task |
| 83 | GET | `/api/airflow/dags/{dagId}/runs/{runId}/gantt` | R Gantt chart data (task timeline) |
| 84 | GET | `/api/airflow/health` | R Airflow health (webserver + scheduler) |
| 85 | GET | `/api/airflow/stats` | R Tổng hợp (running, failed, success theo ngày) |

### 4.7. ✅ Nhóm DATA QUALITY (DQ)

> **Repository gốc:** `src/lakehouse/quality/checks.py` (custom rules), reference `great-expectations` & `tenacity` đã khai báo nhưng chưa dùng

| # | Method | Path | Mô tả |
|---|--------|------|-------|
| 86 | GET | `/api/dq/rules` | L Tất cả DQ rules (lưu Mongo) |
| 87 | GET | `/api/dq/rules/{ruleId}` | R Chi tiết 1 rule |
| 88 | POST | `/api/dq/rules` | C Tạo rule mới (type: null_check, range_check, in_set, unique, regex, custom_sql) |
| 89 | PUT | `/api/dq/rules/{ruleId}` | U Sửa rule |
| 90 | DELETE | `/api/dq/rules/{ruleId}` | D Xoá rule |
| 91 | POST | `/api/dq/rules/{ruleId}/run` | C Chạy 1 rule trên dataset chỉ định (body: layer, table, partition) |
| 92 | POST | `/api/dq/run-suite` | C Chạy suite (nhiều rules trên nhiều datasets) |
| 93 | GET | `/api/dq/runs` | L Lịch sử DQ runs |
| 94 | GET | `/api/dq/runs/{runId}` | R Chi tiết 1 run (per-rule pass/fail) |
| 95 | GET | `/api/dq/summary` | R Dashboard tổng hợp (pass rate theo layer, top failed rules) |
| 96 | GET | `/api/dq/presets` | L Preset rule templates (Bronze null check, Silver dedupe, Gold range...) |

### 4.8. 📚 Nhóm CATALOG (Metadata + Schema)

> **Nguồn:** `src/lakehouse/schemas/*` (CLICKSTREAM, ECOMMERCE_PRODUCT/REVIEW/PRICE, CUSTOMER, PRODUCT, ORDER) + tự động scan tất cả Delta tables

| # | Method | Path | Mô tả |
|---|--------|------|-------|
| 97 | GET | `/api/catalog/databases` | L Tất cả databases (lưu Mongo) |
| 98 | POST | `/api/catalog/databases` | C Tạo database (collection) |
| 99 | DELETE | `/api/catalog/databases/{db}` | D Xoá database |
| 100 | GET | `/api/catalog/databases/{db}/tables` | L Tables trong database |
| 101 | GET | `/api/catalog/tables` | L Tất cả tables (từ cả 3 layer + Mongo) |
| 102 | GET | `/api/catalog/tables/{tableId}` | R Metadata (layer, partition, schema, owner, tags) |
| 103 | PUT | `/api/catalog/tables/{tableId}` | U Update metadata (tags, description, owner) |
| 104 | GET | `/api/catalog/tables/{tableId}/schema` | R Schema (fields + types + nullable) |
| 105 | GET | `/api/catalog/tables/{tableId}/lineage` | R Lineage (upstream + downstream) |
| 106 | GET | `/api/catalog/tables/{tableId}/sample` | R 10 dòng mẫu |
| 107 | GET | `/api/catalog/tables/{tableId}/stats` | R Stats (count, size, last_modified) |
| 108 | POST | `/api/catalog/tables/{tableId}/sync` | C Đồng bộ metadata từ Delta log → Mongo |
| 109 | GET | `/api/catalog/schemas` | L Tất cả schema definitions (từ `src/lakehouse/schemas/`) |
| 110 | GET | `/api/catalog/schemas/{name}` | R Schema definition (JSON) |
| 111 | GET | `/api/catalog/search?q={query}` | R Tìm table theo tên, tag, description |
| 112 | GET | `/api/catalog/health` | R Catalog health (Mongo + DuckDB) |

### 4.9. 🏥 Nhóm HEALTH & SYSTEM (top-level)

| # | Method | Path | Mô tả |
|---|--------|------|-------|
| 113 | GET | `/api/health` | R Overall health (API, Mongo, Redis, MinIO, Kafka, Airflow, DuckDB) |
| 114 | GET | `/api/health/deep` | R Deep health (test query mỗi service) |
| 115 | GET | `/api/info` | R App info (version, uptime, env) |
| 116 | GET | `/api/docs` | R Swagger UI (HTML) |
| 117 | GET | `/api/docs/openapi.json` | R OpenAPI spec (JSON) |

---

## 5. Mẫu thiết kế CRUD với Zod + Repository + Swagger

### 5.1. Ví dụ: Module `crawler`

**Schemas (`modules/crawler/schemas/crawler.schema.ts`):**
```typescript
import { z } from 'zod';

export const CrawlerNameSchema = z.enum([
  'tiki', 'github', 'crypto', 'weather', 'hackernews'
]);

export const CrawlerConfigSchema = z.object({
  rate_limit: z.number().min(0.1).max(60).default(1.0),
  max_retries: z.number().int().min(0).max(10).default(3),
  timeout: z.number().int().min(5).max(300).default(30),
  max_workers: z.number().int().min(1).max(32).default(8),
  kafka_topic: z.string().nullable().default(null),
});

export const CrawlerRunRequestSchema = z.object({
  category: z.string().optional(),
  max_pages: z.number().int().min(1).max(100).default(5),
  language: z.string().optional(),
  since: z.enum(['daily', 'weekly', 'monthly']).optional(),
  dry_run: z.boolean().default(false),
});

export type CrawlerConfig = z.infer<typeof CrawlerConfigSchema>;
export type CrawlerRunRequest = z.infer<typeof CrawlerRunRequestSchema>;
```

**Repository (`modules/crawler/repositories/crawler.repository.ts`):**
```typescript
import { getMongo } from '@/lib/infra/mongo/client';

const COLLECTION = 'crawler_runs';

export const CrawlerRepository = {
  async saveRun(name: string, run: CrawlerRunDocument) {
    const db = await getMongo();
    return db.collection(COLLECTION).insertOne({ crawler: name, ...run });
  },

  async listRuns(name: string, limit = 50) {
    const db = await getMongo();
    return db.collection(COLLECTION)
      .find({ crawler: name })
      .sort({ startedAt: -1 })
      .limit(limit)
      .toArray();
  },

  async getConfig(name: string): Promise<CrawlerConfig> {
    const db = await getMongo();
    const doc = await db.collection('crawler_configs').findOne({ name });
    return CrawlerConfigSchema.parse(doc ?? DEFAULT_CONFIGS[name]);
  },

  async updateConfig(name: string, config: CrawlerConfig) {
    const db = await getMongo();
    return db.collection('crawler_configs').updateOne(
      { name },
      { $set: { name, ...config, updatedAt: new Date() } },
      { upsert: true }
    );
  },
};
```

**Controller (`modules/crawler/controllers/crawler.controller.ts`):**
```typescript
import { CrawlerRunRequestSchema, CrawlerConfigSchema } from '../schemas/crawler.schema';
import { CrawlerService } from '../services/crawler.service';

export const CrawlerController = {
  async list() {
    return CrawlerService.listAll();
  },

  async run(name: string, body: unknown) {
    const req = CrawlerRunRequestSchema.parse(body);
    return CrawlerService.run(name, req);
  },

  async runAsync(name: string, body: unknown) {
    const req = CrawlerRunRequestSchema.parse(body);
    return CrawlerService.runAsync(name, req);
  },

  async getConfig(name: string) {
    return CrawlerService.getConfig(name);
  },

  async updateConfig(name: string, body: unknown) {
    const cfg = CrawlerConfigSchema.parse(body);
    return CrawlerService.updateConfig(name, cfg);
  },
};
```

**Service (`modules/crawler/services/crawler.service.ts`):**
```typescript
import { CRAWLER_REGISTRY } from '@/lib/infra/crawlers/registry';
import { getJobQueue } from '@/lib/jobs/queue';
import { CrawlerRepository } from '../repositories/crawler.repository';

export const CrawlerService = {
  async listAll() {
    return Object.entries(CRAWLER_REGISTRY).map(([name, meta]) => ({
      name, kafkaTopic: meta.kafkaTopic, sourceName: meta.sourceName,
    }));
  },

  async run(name: string, req: CrawlerRunRequest) {
    const CrawlerClass = CRAWLER_REGISTRY[name].class;
    const crawler = new CrawlerClass(req);
    const items = await crawler.crawl();
    await CrawlerRepository.saveRun(name, {
      status: 'success', itemsCount: items.length, startedAt: new Date(), request: req,
    });
    return { itemsCount: items.length, sample: items.slice(0, 5) };
  },

  async runAsync(name: string, req: CrawlerRunRequest) {
    const queue = getJobQueue('crawler');
    const job = await queue.add('run', { name, req }, { removeOnComplete: 100, removeOnFail: 50 });
    return { jobId: job.id, status: 'queued' };
  },
  // ...
};
```

**Route (`app/api/crawler/[name]/run/route.ts`):**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/middlewares/with-error-handler';
import { withRequestId } from '@/middlewares/with-request-id';
import { CrawlerController } from '@/modules/crawler/controllers/crawler.controller';

export const runtime = 'nodejs';

/**
 * @swagger
 * /api/crawler/{name}/run:
 *   post:
 *     summary: Trigger a crawler run
 *     tags: [Crawler]
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema: { type: string, enum: [tiki, github, crypto, weather, hackernews] }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CrawlerRunRequest'
 *     responses:
 *       200: { description: Crawl completed }
 *       202: { description: Crawl queued }
 *       400: { description: Invalid input }
 *       404: { description: Crawler not found }
 */
export const POST = withRequestId(withErrorHandler(async (
  req: NextRequest,
  { params }: { params: { name: string } }
) => {
  const body = await req.json().catch(() => ({}));
  const result = await CrawlerController.run(params.name, body);
  return NextResponse.json(result);
}));
```

### 5.2. HOF Middleware composable

```typescript
// middlewares/with-error-handler.ts
import { AppError } from '@/errors/AppError';
import { logger } from '@/lib/logger/pino';

export function withErrorHandler<T extends (...args: any[]) => Promise<Response>>(
  handler: T
): T {
  return (async (...args) => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof AppError) {
        return NextResponse.json({ error: err.code, message: err.message }, { status: err.status });
      }
      if (err instanceof z.ZodError) {
        return NextResponse.json({ error: 'VALIDATION_ERROR', issues: err.issues }, { status: 400 });
      }
      logger.error({ err }, 'Unhandled error');
      return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
    }
  }) as T;
}
```

---

## 6. NoSQL (MongoDB) — Collection Design

> Mongo dùng để lưu **metadata + log + config + job tracking**. KHÔNG lưu data lake (Delta Lake đã là source of truth).

| Collection | Mục đích | Indexes |
|------------|----------|---------|
| `crawler_runs` | Lịch sử mỗi lần crawl | `{ crawler: 1, startedAt: -1 }`, `{ status: 1 }` |
| `crawler_configs` | Config override từng crawler | `{ name: 1 }` unique |
| `bronze_jobs` | Ingest job tracking | `{ status: 1, createdAt: -1 }` |
| `silver_jobs` | Transform job tracking | `{ status: 1, table: 1, createdAt: -1 }` |
| `gold_jobs` | Aggregate job tracking | `{ status: 1, table: 1, createdAt: -1 }` |
| `airflow_runs` | Mirror DAG run history | `{ dagId: 1, runId: 1 }` unique |
| `dq_rules` | DQ rule definitions | `{ name: 1 }` unique, `{ layer: 1, table: 1 }` |
| `dq_runs` | DQ execution results | `{ ruleId: 1, runAt: -1 }` |
| `catalog_tables` | Table metadata (synced từ Delta) | `{ tableId: 1 }` unique, `{ layer: 1, table: 1 }` |
| `catalog_schemas` | Schema definitions | `{ name: 1 }` unique |
| `api_logs` | Request/response log (TTL 7 ngày) | `{ requestId: 1 }`, `{ createdAt: -1 }` TTL |
| `users` | **KHÔNG CÓ** (theo yêu cầu không auth) | — |

### Mongoose connection cache pattern

```typescript
// lib/infra/mongo/client.ts
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/lakehouse';

interface MongooseCache { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null; }
const globalForMongo = globalThis as unknown as { _mongooseCache?: MongooseCache };
const cache = globalForMongo._mongooseCache ?? { conn: null, promise: null };
if (!globalForMongo._mongooseCache) globalForMongo._mongooseCache = cache;

export async function getMongo(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    cache.promise = mongoose.connect(MONGODB_URI, { bufferCommands: false });
  }
  cache.conn = await cache.promise;
  return cache.conn;
}
```

---

## 7. Env variables (cập nhật `.env.example`)

```bash
# ===== EXISTING (giữ nguyên) =====
ENV=local
LOG_LEVEL=INFO

MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_SECURE=false

KAFKA_BOOTSTRAP=localhost:9092
KAFKA_SECURITY_PROTOCOL=PLAINTEXT

SPARK_MASTER=local[*]
SPARK_DRIVER_MEMORY=2g
SPARK_EXECUTOR_MEMORY=2g

DELTA_PACKAGE=io.delta:delta-spark_2.12:3.0.0
KAFKA_PACKAGE=org.apache.spark:spark-sql-kafka-0-10_2.12:3.4.0

DQ_MAX_NULL_PERCENT=5.0
DQ_FAIL_ON_ERROR=false

TIKI_API_BASE=https://tiki.vn/api/v2
CRAWLER_RATE_LIMIT=1.0
CRAWLER_MAX_WORKERS=8
CRAWLER_TIMEOUT=30

# ===== NEW: BE API (thêm) =====
API_PORT=3001
API_BASE_PATH=/api
API_CORS_ORIGINS=http://localhost:3000,http://localhost:3001
API_RATE_LIMIT_PER_MIN=600
API_LOG_LEVEL=info
API_SWAGGER_ENABLED=true

# ===== NEW: MongoDB (NoSQL) =====
MONGO_URI=mongodb://localhost:27017
MONGO_DB=lakehouse_catalog
MONGO_MAX_POOL_SIZE=20

# ===== NEW: Redis (cache + BullMQ) =====
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# ===== NEW: DuckDB (in-process, không cần connection string) =====
DUCKDB_MEMORY_LIMIT=4GB
DUCKDB_THREADS=4

# ===== NEW: Airflow REST (proxy) =====
AIRFLOW_BASE_URL=http://localhost:8088/api/v2
AIRFLOW_USERNAME=admin
AIRFLOW_PASSWORD=admin

# ===== NEW: Crawler tuning (override default) =====
CRAWLER_TIKI_MAX_PAGES=5
CRAWLER_GITHUB_MAX_REPOS=50
CRAWLER_CRYPTO_TOP_N=100
CRAWLER_WEATHER_CITIES=hanoi,ho_chi_minh,da_nang
CRAWLER_HN_MAX_STORIES=50
```

### Zod validation runtime (`config/env.ts`)

```typescript
import { z } from 'zod';

const EnvSchema = z.object({
  ENV: z.enum(['local', 'dev', 'staging', 'prod']).default('local'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  MINIO_ENDPOINT: z.string(),
  MINIO_ACCESS_KEY: z.string(),
  MINIO_SECRET_KEY: z.string(),
  MINIO_SECURE: z.coerce.boolean().default(false),

  KAFKA_BOOTSTRAP: z.string(),
  KAFKA_SECURITY_PROTOCOL: z.string().default('PLAINTEXT'),

  MONGO_URI: z.string().default('mongodb://localhost:27017'),
  MONGO_DB: z.string().default('lakehouse_catalog'),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),

  AIRFLOW_BASE_URL: z.string().url().optional(),

  API_PORT: z.coerce.number().default(3001),
  API_SWAGGER_ENABLED: z.coerce.boolean().default(true),
  API_CORS_ORIGINS: z.string().default('http://localhost:3000'),
});

export const env = EnvSchema.parse(process.env);
```

---

## 8. Thay đổi Docker Compose

Thêm 3 services mới vào `docker-compose.yml`:

```yaml
services:
  api:
    build: ./apps/api
    container_name: lake-api
    ports: ["3001:3001"]
    env_file: .env
    depends_on: [mongo, redis, minio, redpanda, airflow-webserver]
    volumes: ["./apps/api/src:/app/src", "./apps/api/package.json:/app/package.json"]
    command: pnpm dev

  mongo:
    image: mongo:7
    container_name: lake-mongo
    ports: ["27017:27017"]
    volumes: ["mongo_data:/data/db"]

  mongo-express:  # optional: UI quản lý Mongo
    image: mongo-express:latest
    ports: ["8082:8081"]
    environment:
      ME_CONFIG_MONGODB_SERVER: mongo

  redis:
    image: redis:7-alpine
    container_name: lake-redis
    ports: ["6379:6379"]
    volumes: ["redis_data:/data"]

volumes:
  mongo_data:
  redis_data:
```

---

## 9. Roadmap triển khai (8 tuần)

| Tuần | Phase | Deliverable |
|------|-------|-------------|
| 1 | **Foundation** | Scaffold `apps/api`, Next.js + TS, Zod env, Pino logger, Mongo + Redis + DuckDB singletons, base middlewares, Swagger UI hoạt động |
| 2 | **Catalog + Health** | Catalog CRUD (8 endpoints) + Health/Info + OpenAPI auto-gen + `/api-doc` UI |
| 3 | **Bronze + Silver** | 28 endpoints Bronze/Silver, BullMQ cho ingest/transform, vacuum, time-travel |
| 4 | **Gold + Queries** | 17 endpoints Gold + 4 wrapped SQL queries + ad-hoc query sandbox |
| 5 | **Crawler** | 13 endpoints Crawler, tích hợp lại 5 crawler hiện có (TypeScript port) |
| 6 | **Kafka** | 14 endpoints Kafka admin + produce + lag monitoring |
| 7 | **Airflow + DQ** | 13 Airflow proxy + 11 DQ rules (Zod-based custom + great-expectations adapter) |
| 8 | **Polish + Docs** | Integration test, README, OpenAPI example client, Docker compose, handoff |

---

## 10. Rủi ro & Mitigation

| # | Rủi ro | Mức độ | Mitigation |
|---|--------|--------|------------|
| R1 | DuckDB native binding không tương thích Next.js bundler | Cao | Dùng `serverExternalPackages` + chạy thử trên Node 20 |
| R2 | Airflow REST API thay đổi version | Thấp | Pin version + adapter pattern |
| R3 | MongoDB connection leak khi Next.js hot-reload | Trung bình | Global cache pattern (đã có snippet) |
| R4 | BullMQ cần Redis riêng → thêm 1 container | Thấp | Đã có trong docker-compose |
| R5 | Spark job trigger từ Node có thể fail khi không có Spark client | Trung bình | Option 1: chạy qua Airflow REST thay vì spawn trực tiếp; Option 2: chỉ trigger, không wait |
| R6 | 110+ endpoints → khó test | Thấp | Test theo module (8 module × integration test) |
| R7 | TypeScript port của 5 crawler tốn effort | Trung bình | Phase 5 có thể wrap Python crawler qua subprocess trước, port dần |
| R8 | Storage layout trong MinIO khác thực tế | Thấp | Cần verify với `s3 ls` trước khi code |

---

## 11. Đề xuất bước tiếp theo (chờ sếp duyệt)

1. **Sếp review plan này** (file `docs/plan/plan_overview/20-backend-nextjs-plan.md`).
2. Sếp xác nhận 4 quyết định chính đã chốt ở session trước:
   - Next.js Route Handlers + Swagger-jsdoc
   - DuckDB query Delta Lake
   - Full management (8 nhóm)
   - MongoDB cho NoSQL
3. Sếp cho em bắt đầu **Phase 1 (Foundation)** hay muốn em điều chỉnh plan trước?

---

**Tác giả ký:**
`Main Agent (Cursor IDE AI) — data-lake-architecture-claude coordinator — 2026-10-06 (Plan v1.0, chờ sếp review)`
