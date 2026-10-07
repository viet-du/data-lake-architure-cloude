# Backend API — Phase Execution Plan

> **Project:** Data Lake Backend (Next.js 15 + TypeScript)
> **Tác giả:** Main Agent (Cursor IDE AI) — 2026-10-06
> **Thứ tự:** Sequential (Foundation → Catalog → Bronze/Silver → Gold → Crawler → Kafka → Airflow/DQ → Polish)
> **Độ chi tiết:** Coarse-grained (22 tasks, 8 phases)

---

## 🎯 Tổng quan

| Phase | Tên | Tasks | Tuần |
|-------|-----|-------|------|
| **P1** | Foundation | 5 | 1 |
| **P2** | Catalog + Health | 3 | 2 |
| **P3** | Bronze + Silver | 2 | 3 |
| **P4** | Gold + Queries | 2 | 4 |
| **P5** | Crawler | 2 | 5 |
| **P6** | Kafka | 2 | 6 |
| **P7** | Airflow + DQ | 3 | 7 |
| **P8** | Polish + Docs | 2 | 8 |
| | **TỔNG CỘNG** | **22** | **8 tuần** |

---

## Phase 1 — Foundation (Tuần 1)

> **Mục tiêu:** Có BE skeleton chạy được, Swagger UI hoạt động tại `/api-doc`

### P1-T1 — Scaffold project & install dependencies
**Mô tả:**
- Tạo `apps/api/` với Next.js 15 App Router
- TypeScript 5.x strict mode (`strict: true`, `noUncheckedIndexedAccess: true`)
- Cài đủ 19 packages: `zod`, `mongoose`, `ioredis`, `kafkajs`, `@aws-sdk/client-s3`, `bullmq`, `pino`, `next-swagger-doc`, `swagger-ui-react`, `@duckdb/node-api`, `@types/*`
- Init `package.json`, `tsconfig.json`, `.eslintrc.json`

### P1-T2 — Next.js config & env validation
**Mô tả:**
- `next.config.ts`: `serverExternalPackages: ['@duckdb/node-api', 'mongoose']`
- `tsconfig.json`: paths alias `@/*` → `./src/*`
- `src/config/env.ts`: Zod schema cho tất cả env vars (25 existing + 25 new), throw ở startup nếu thiếu required
- `src/config/constants.ts`: MAX_PAGE_SIZE, DEFAULT_TIMEOUT, DELTA_RETENTION_DAYS, etc.

### P1-T3 — Lib/infra singletons
**Mô tả:**
- `src/lib/infra/duckdb/client.ts`: Singleton DuckDB, install `delta` + `httpfs`, create MinIO secret (s3a://), connection cache
- `src/lib/infra/mongo/client.ts`: Mongoose connect với global cache pattern, `bufferCommands: false`
- `src/lib/infra/redis/client.ts`: ioredis singleton
- `src/lib/infra/s3/client.ts`: @aws-sdk/client-s3 (path-style MinIO)
- `src/lib/logger/pino.ts`: Pino logger với request-id, pretty print local, JSON prod

### P1-T4 — Base middlewares & error handling
**Mô tả:**
- `src/middlewares/withErrorHandler.ts`: HOF bắt AppError/ZodError/unknown, trả NextResponse đúng format `{ error, message?, issues? }`
- `src/middlewares/withRequestId.ts`: Gắn `x-request-id` header vào mọi request
- `src/middlewares/withCors.ts`: CORS từ `API_CORS_ORIGINS` env
- `src/middlewares/withRateLimit.ts`: Redis-based rate limit (`API_RATE_LIMIT_PER_MIN`)
- `src/errors/AppError.ts`, `NotFoundError.ts`, `ValidationError.ts`, `ConflictError.ts`
- `src/lib/http/response-builder.ts`: Helper `ok()`, `created()`, `noContent()`, `error()`

### P1-T5 — Swagger setup + Docker compose
**Mô tả:**
- `src/app/api/docs/openapi.json/route.ts`: `next-swagger-doc` auto-gen spec
- `src/app/api-doc/page.tsx` + `SwaggerUIClient.tsx`: Swagger UI tại `/api-doc`
- `src/app/page.tsx`: Landing page với links tới `/api-doc`, `/health`
- Cập nhật `docker-compose.yml`: thêm services `api`, `mongo`, `redis`, `mongo-express`
- Tạo `apps/api/Dockerfile`
- Verify: `curl http://localhost:3001/api/health` trả JSON, `curl http://localhost:3001/api-doc` trả Swagger UI

---

## Phase 2 — Catalog + Health (Tuần 2)

> **Mục tiêu:** Có metadata browser hoạt động, có health dashboard

### P2-T1 — Catalog 16 endpoints CRUD
**Mô tả:**
- `modules/catalog/controllers/catalog.controller.ts`
- `modules/catalog/schemas/catalog.schema.ts`: Zod schemas cho table metadata, database, schema definition
- `modules/catalog/services/catalog.service.ts`: Business logic
- `modules/catalog/repositories/catalog.repository.ts`: DuckDB scan Delta tables + MongoDB CRUD
- 16 routes:
  - `GET/POST/DELETE /api/catalog/databases`
  - `GET /api/catalog/databases/{db}/tables`
  - `GET /api/catalog/tables`, `GET/PUT /api/catalog/tables/{id}`
  - `GET /api/catalog/tables/{id}/schema`, `/lineage`, `/sample`, `/stats`
  - `POST /api/catalog/tables/{id}/sync`
  - `GET /api/catalog/schemas`, `GET /api/catalog/schemas/{name}`
  - `GET /api/catalog/search?q=...`
- MongoDB collections: `catalog_tables`, `catalog_schemas`, `catalog_databases`
- Indexes đầy đủ

### P2-T2 — Catalog service + lineage graph
**Mô tả:**
- DuckDB `delta_latest` function để lấy schema tự động từ Delta metadata
- Table lineage graph: xây dựng từ pipeline mapping (Bronze→Silver→Gold)
- Auto-sync Delta log → Mongo (khi `/sync` được gọi hoặc background job)
- Schema validation dựa trên `src/lakehouse/schemas/*.py` (mapping sang JSON)

### P2-T3 — Health 4 endpoints
**Mô tả:**
- `GET /api/health`: Overall status (up/down per service)
- `GET /api/health/deep`: Test thực tế mỗi service (DuckDB query, Mongo ping, Redis ping, S3 head-bucket, Kafka admin metadata, Airflow health)
- `GET /api/info`: `{ name, version, env, uptime, nodeVersion }`
- `GET /api/docs`: Redirect hoặc serve Swagger UI
- Health check dùng cho container orchestration (docker healthcheck)

---

## Phase 3 — Bronze + Silver (Tuần 3)

> **Mục tiêu:** Browsing + trigger pipeline Bronze/Silver hoạt động

### P3-T1 — Bronze 14 endpoints
**Mô tả:**
- 14 routes Bronze (xem plan §4.1)
- `modules/bronze/repositories/bronze.repository.ts`: DuckDB query Delta `s3a://bronze/*`
- `modules/bronze/services/bronze.service.ts`
- `modules/bronze/jobs/bronze.ingest.job.ts`: BullMQ worker xử lý CSV/JSON ingest
- `GET /api/bronze/{table}/history`: `DESCRIBE HISTORY` Delta
- `POST /api/bronze/{table}/vacuum`: `VACUUM` với retention 7 ngày
- `DELETE /api/bronze/{table}/partitions/{date}`: xoá partition
- Job tracking: `bronze_jobs` MongoDB collection

### P3-T2 — Silver 14 endpoints
**Mô tả:**
- 14 routes Silver (xem plan §4.2)
- `modules/silver/repositories/silver.repository.ts`: DuckDB query `s3a://silver/*`
- `modules/silver/services/silver.service.ts`
- `POST /api/silver/{table}/transform`: Trigger transform (spawn Python subprocess hoặc qua Airflow trigger)
- `POST /api/silver/transform/all`: Trigger tất cả Silver transforms (parallel)
- `GET /api/silver/{table}/time-travel/{version}`: `SELECT * FROM table TIMESTAMP AS OF ...`
- `GET /api/silver/{table}/diff/{v1}/{v2}`: So sánh 2 Delta versions
- Job tracking: `silver_jobs` MongoDB collection

---

## Phase 4 — Gold + Queries (Tuần 4)

> **Mục tiêu:** Analytics queries hoạt động, dashboard data sẵn sàng

### P4-T1 — Gold 17 endpoints (table management)
**Mô tả:**
- 17 routes Gold (xem plan §4.3) — phần table management
- `modules/gold/repositories/gold.repository.ts`: DuckDB query `s3a://gold/*`
- `modules/gold/services/gold.service.ts`
- `POST /api/gold/{table}/aggregate`: Trigger aggregate
- `POST /api/gold/aggregate/all`: Trigger tất cả Gold aggregates
- Job tracking: `gold_jobs` MongoDB collection

### P4-T2 — Gold 4 SQL query wrappers + ad-hoc
**Mô tả:**
- `GET /api/gold/queries/business-metrics`: Wrap `01_business_metrics.sql` với params `{ days, limit }`
- `GET /api/gold/queries/customer-analytics`: Wrap `02_customer_analytics.sql` với params `{ segment }`
- `GET /api/gold/queries/product-performance`: Wrap `03_product_performance.sql` với params `{ category, days }`
- `GET /api/gold/queries/category-revenue`: Wrap `04_category_revenue.sql` với params `{ parent_category, limit }`
- `GET /api/gold/queries/ad-hoc`: Chạy custom SQL (whitelist: SELECT only, blacklist: INSERT/UPDATE/DELETE/DROP/CREATE, row limit 10000)
- Response format: `{ data: [], meta: { rowCount, executionTimeMs, queryId } }`
- Query history logging (lưu MongoDB, chặn SQL injection)

---

## Phase 5 — Crawler (Tuần 5)

> **Mục tiêu:** 5 crawlers có thể trigger, monitor, config từ API

### P5-T1 — Crawler 13 endpoints
**Mô tả:**
- 13 routes Crawler (xem plan §4.4)
- `modules/crawler/controllers/crawler.controller.ts`
- `modules/crawler/schemas/crawler.schema.ts`: Zod schemas cho run request + config
- `modules/crawler/repositories/crawler.repository.ts`: MongoDB CRUD cho runs + configs
- `modules/crawler/services/crawler.service.ts`

### P5-T2 — Crawler TypeScript integration
**Mô tả:**
- `src/lib/infra/crawlers/registry.ts`: Registry pattern map `name → { class, kafkaTopic, sourceName }`
- TypeScript implementation của 5 crawlers:
  - `TikiCrawler`: fetch Tiki API, parallel pages, push Kafka
  - `GithubCrawler`: GitHub Search API, trending repos
  - `CryptoCrawler`: CoinGecko API, top N coins
  - `WeatherCrawler`: Open-Meteo API, multiple cities
  - `HackernewsCrawler`: HN Firebase API, top stories
- `BullMQ` worker: `modules/crawler/jobs/crawler.worker.ts`
- Crawl run history: `crawler_runs` MongoDB (stats: success/failed/skipped counts)
- Preview mode (dry-run): chạy 1 page, trả về 5 items mà không push Kafka

---

## Phase 6 — Kafka (Tuần 6)

> **Mục tiêu:** Kafka topic management hoạt động, producer/consumer từ API

### P6-T1 — Kafka 14 endpoints
**Mô tả:**
- 14 routes Kafka (xem plan §4.5)
- `modules/kafka/controllers/kafka.controller.ts`
- `modules/kafka/schemas/kafka.schema.ts`: Zod schemas cho produce request, topic config, consumer group config
- `modules/kafka/repositories/kafka.repository.ts`: MongoDB cho metadata
- `modules/kafka/services/kafka.service.ts`

### P6-T2 — Kafka kafkajs integration
**Mô tả:**
- `src/lib/infra/kafka/admin.ts`: kafkajs Kafka admin client (Redpanda compatible)
- `src/lib/infra/kafka/producer.ts`: kafkajs producer singleton
- Topic CRUD: create với partitions/replication/retention, delete
- Message peek: consume N messages mới nhất (auto-commit off, groupId temp)
- Produce: single + batch (async, không blocking)
- Consumer group: list members, lag per partition, reset offset (earliest/latest/specific)
- Cluster info: brokers, controller, version

---

## Phase 7 — Airflow + DQ (Tuần 7)

> **Mục tiêu:** DAG management + Data Quality rules hoạt động

### P7-T1 — Airflow 13 endpoints
**Mô tả:**
- 13 routes Airflow (xem plan §4.6)
- `modules/airflow/controllers/airflow.controller.ts`
- `modules/airflow/repositories/airflow.repository.ts`: MongoDB cho local cache
- `modules/airflow/services/airflow.service.ts`
- `src/lib/infra/airflow/client.ts`: Fetch wrapper cho Airflow REST API v2, auth header, retry logic
- Proxy: DAG trigger, pause/unpause, runs list/detail/delete, task instances, task logs, gantt data
- Airflow health + stats: aggregate running/failed/success

### P7-T2 — DQ 11 endpoints (CRUD)
**Mô tả:**
- 11 routes DQ (xem plan §4.7)
- `modules/dq/controllers/dq.controller.ts`
- `modules/dq/schemas/dq.schema.ts`: Zod schemas cho 6 rule types
- `modules/dq/repositories/dq.repository.ts`: MongoDB CRUD cho rules + runs
- `modules/dq/services/dq.service.ts`

### P7-T3 — DQ integration + rule executor
**Mô tả:**
- `modules/dq/executors/rule-executor.ts`: DuckDB-based executor
- 6 rule types:
  - `null_check`: `SELECT COUNT(*) WHERE col IS NULL / total > threshold`
  - `range_check`: `SELECT COUNT(*) WHERE col NOT BETWEEN min AND max / total > threshold`
  - `in_set`: whitelist values
  - `unique`: `SELECT COUNT(*) - COUNT(DISTINCT col) FROM table` phải = 0
  - `regex`: `SELECT COUNT(*) WHERE NOT REGEXP_MATCH(col, pattern) / total > threshold`
  - `custom_sql`: chạy arbitrary SELECT, kiểm tra result = 0 rows fail
- Preset templates: Bronze null check, Silver dedupe, Gold revenue range
- DQ results: `dq_runs` MongoDB collection với per-rule pass/fail
- Summary dashboard: pass rate theo layer, top failed rules

---

## Phase 8 — Polish + Docs (Tuần 8)

> **Mục tiêu:** Production-ready, có docs, sẵn sàng handoff

### P8-T1 — Integration test + README
**Mô tả:**
- Integration test cho 8 nhóm endpoints (vitest)
- `apps/api/README.md`: Setup (env, Docker, local dev), Run (dev/prod), API docs link, Architecture diagram, Contributing guide
- OpenAPI client example snippets (curl, TypeScript fetch)
- Tổng hợp `docker-compose.yml` đầy đủ (tất cả services: lakehouse + api)
- `apps/api/.env.example` đầy đủ

### P8-T2 — Verify + handoff
**Mô tả:**
- Smoke test: tất cả 117 endpoints trả đúng status code
- Stress test BullMQ: 100 concurrent ingest jobs
- Edge cases: hot-reload Mongo connection, DuckDB memory limit, Redis reconnect
- Fix connection leak (nếu có)
- Handoff checklist: env vars checklist, ports checklist, known issues, next steps

---

## 📊 Bảng tổng hợp Tasks

| Phase | Task | Deliverable | Tuần |
|-------|------|-------------|------|
| P1 | T1 | Project scaffold + 19 deps | 1 |
| P1 | T2 | Config + env validation | 1 |
| P1 | T3 | 5 singletons (DuckDB/Mongo/Redis/S3/Logger) | 1 |
| P1 | T4 | 5 middlewares + error handling | 1 |
| P1 | T5 | Swagger UI + Docker compose | 1 |
| P2 | T1 | 16 Catalog endpoints | 2 |
| P2 | T2 | Catalog service + lineage | 2 |
| P2 | T3 | 4 Health endpoints | 2 |
| P3 | T1 | 14 Bronze endpoints | 3 |
| P3 | T2 | 14 Silver endpoints | 3 |
| P4 | T1 | 17 Gold endpoints (table mgmt) | 4 |
| P4 | T2 | 5 SQL query endpoints | 4 |
| P5 | T1 | 13 Crawler endpoints | 5 |
| P5 | T2 | 5 crawlers + BullMQ worker | 5 |
| P6 | T1 | 14 Kafka endpoints | 6 |
| P6 | T2 | kafkajs integration | 6 |
| P7 | T1 | 13 Airflow endpoints | 7 |
| P7 | T2 | 11 DQ endpoints CRUD | 7 |
| P7 | T3 | DQ rule executor | 7 |
| P8 | T1 | Integration test + README | 8 |
| P8 | T2 | Verify + handoff | 8 |
| | | **22 tasks** | **8 tuần** |

---

## ✅ Definition of Done cho mỗi Phase

- [ ] Tất cả endpoints trả đúng HTTP status code
- [ ] Swagger JSDoc annotation đầy đủ, spec sinh ra chính xác
- [ ] Zod validation hoạt động (invalid input → 400)
- [ ] MongoDB operations đúng indexes
- [ ] DuckDB queries chạy đúng với sample data
- [ ] Không có TypeScript error (`tsc --noEmit`)
- [ ] Không có hardcoded secrets (dùng env)
- [ ] Unit test hoặc integration test cho service layer

---

**Tác giả:** Main Agent (Cursor IDE AI) — 2026-10-06
