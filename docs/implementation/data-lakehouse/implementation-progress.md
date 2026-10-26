# Data Lakehouse — Implementation Ledger

**Project:** Data Lakehouse cho dữ liệu bán hàng (ETL/ELT), Interactive Control Plane, EDA & DQ
**Primary spec:** `docs/DATA_LAKEHOUSE_INTERACTIVE_CONTROL_PLANE_EDA_DQ_MASTER_PLAN_2026-10-24.md` (1007 dòng, Section 00–17)
**Execution mode:** `DEEP SOURCE ANALYSIS → IMPLEMENTATION → TESTING → VERIFICATION → DEBUGGING → REFACTORING → REGRESSION → PHASE ACCEPTANCE → NEXT PHASE`

---

## 0. Thông tin phiên làm việc

| Field | Value |
|---|---|
| Branch | `dev-v3` |
| HEAD commit | `1feadc1` — `fix: remove leaked Metabase API key from .env.example` |
| Tracking | `origin/dev-v3` |
| Working tree | **DIRTY** — 13 modified, 1 deleted, 3 untracked (Kafka fixes chưa commit) |
| Environment | macOS darwin 27.0.0, Node 26.7.0, pnpm workspace, Docker Desktop |
| Host | `127.0.0.1` |
| API | `http://localhost:3001` (Next.js dev, PID 59528) |
| Web | `http://localhost:5173` (Vite dev, PID 59516) |
| Worker | `tsx src/workers/main.ts` (PID 59542) |
| Audit date | 2026-10-24 |

> **Bằng chứng nguồn:** Toàn bộ số liệu dưới đây lấy từ lệnh thực thi thật, không từ tài liệu cũ hay screenshot.

---

## 1. Phase Progress

| Phase | Tên | Trạng thái | Exit Gate |
|---|---|---|---|
| **0** | Current Source Audit & Baseline Freeze | ✅ **PASS** | Register + evidence thực tế |
| **1** | Core Correctness, Storage & Security | ⏳ NEXT | — |
| **2** | Unified Operations & Run Lifecycle | ⏸️ PENDING | — |
| **3** | Airflow Interactive Workflows | ⏸️ PENDING | — |
| **4** | Kafka Management & Streaming Ingestion | ⏸️ PENDING | — |
| **5** | EDA & Data Profiling Backend | ⏸️ PENDING | — |
| **6** | EDA Frontend & Data Quality UX | ⏸️ PENDING | — |
| **7** | Home KPI, Activity, Schematic, Observability | ⏸️ PENDING | — |
| **8** | Research Validation, Performance & Release | ⏸️ PENDING | — |

---

## 2. PHASE 0 — Current Architecture & Gap Register

### 2.1 Baseline runtime thực tế

**Containers đang chạy (7, tất cả healthy):**

| Container | Image | Status | Role |
|---|---|---|---|
| `lake-minio` | `portlink/minio:RELEASE.2024-10-13T13-34-11Z` | Up 6h healthy | Object storage |
| `lake-mongo` | `mongo:7.0` | Up 6h healthy | Catalog / job / DQ metadata |
| `lake-redis` | `redis:7.2-alpine` | Up 6h healthy | BullMQ queue |
| `lake-redpanda` | `redpandadata/redpanda:v24.1.7` | Up 6h healthy | Kafka broker (thay `cp-kafka`) |
| `lake-airflow-db` | `postgres:13` | Up 6h healthy | Airflow metadata DB |
| `lake-airflow-scheduler` | `apache/airflow:2.7.0-python3.11` | Up 5h healthy | Scheduler (**BASE IMAGE**) |
| `lake-airflow-webserver` | `apache/airflow:2.7.0-python3.11` | Up 6h healthy | REST API (**BASE IMAGE**) |

**Containers KHÔNG chạy (thiếu image / chưa build):**

| Service trong compose | Image | Trạng thái | Ảnh hưởng |
|---|---|---|---|
| `spark-master` | `lake-spark:3.5.6` | ❌ **Image không tồn tại** | DAG `docker exec lake-spark-master spark-submit` sẽ fail |
| `spark-worker` | `lake-spark:3.5.6` | ❌ Image không tồn tại | Không có Spark executor |
| `kafka` (cp-kafka) + `zookeeper` | `confluentinc/cp-kafka:7.5.0` | ❌ Chưa start | Đang dùng **redpanda** thay thế |
| `kafka-ui` | `provectuslabs/kafka-ui` | ❌ Chưa start | — |
| `lake-api` / `lake-web` | build local | ❌ Chưa start | Chạy dev server ngoài Docker |
| `metabase`, `gold-postgres`, `postgres` (hive) | — | ❌ Chưa start | Analytics phụ |

> **Bằng chứng:** `docker images` không có `lake-spark:3.5.6` hay `lake-airflow:2.7.0`; `docker ps -a` chỉ có 7 container `lake-*` ở trạng thái Up.

### 2.2 Storage state — **KHÔNG CÓ DỮ LIỆU NÀO**

```
mc ls local/            → bronze/ (0B)  gold/ (0B)  lakehouse/ (0B)  scripts/ (0B)  silver/ (0B)
mc ls --recursive local/lakehouse/  → (rỗng)
mc ls --recursive local/bronze/     → (rỗng)
```

**Tất cả bucket rỗng.** Không có Bronze/Silver/Gold table nào tồn tại ở local provider. Điều này giải thích vì sao mọi job path đều chưa từng chạy thành công.

### 2.3 Kafka state

```
rpk cluster info → 1 broker (redpanda:9092), clusterId redpanda.727c57c2-...
rpk topic list   → (chỉ __consumer_offsets, internal)
rpk group list   → (rỗng)
GET /api/kafka/cluster → { clusterId, controller:0, brokers:[1], topicsCount:0, consumerGroupsCount:0 }
GET /api/kafka/topics  → { topics: [], count: 0 }
```

**Kafka broker healthy, 0 topic là empty state hợp lệ** (không phải lỗi). Producer đã có `idempotent: true`, `allowAutoTopicCreation: false` (đúng — không tự tạo topic).

### 2.4 Airflow state — 3 DAG IMPORT ERRORS

`GET /api/v1/dags` → **total_entries: 1** (`retail_elt_dag`, paused=true)
`GET /api/v1/importErrors` → **count: 3**:

| File | Error | Nguyên nhân |
|---|---|---|
| `crawler_dag.py` | `ModuleNotFoundError: No module named 'kafka'` | Image base không có `kafka-python` |
| `ecommerce_streaming_dag.py` | `ModuleNotFoundError: No module named 'delta'` | Image base không có `delta-spark` |
| `clickstream_streaming_dag.py` | `ModuleNotFoundError: No module named 'delta'` | Image base không có `delta-spark` |

**Root cause:** container đang chạy với image `apache/airflow:2.7.0-python3.11` (base) thay vì `lake-airflow:2.7.0` custom build (`Dockerfile.airflow` có pre-bake `delta-spark` + `kafka-python` + JRE). Verify trong container:

```
delta    MISSING ModuleNotFoundError
kafka    MISSING ModuleNotFoundError
pyspark  MISSING ModuleNotFoundError
boto3    OK
```

→ **4 DAG trong source, chỉ 1 DAG parse được.** Đúng như MASTER PLAN §01.1.9 dự đoán.

### 2.5 Databricks provider (read-only) — ĐANG ACTIVE

```
.env          : LAKEHOUSE_DATA_SOURCE=databricks
apps/api/.env.local : LAKEHOUSE_DATA_SOURCE=databricks
GET /api/catalog/databases → workspace.bronze (3 tables), workspace.gold (3), workspace.silver (3), workspace.default (0)
GET /api/health/deep       → Databricks: degraded, warehouseState: STOPPED
```

**Hệ quả trực tiếp:** `remoteReadOnly()` (`apps/api/src/lib/infra/databricks/client.ts:88`) ném `409 DATABRICKS_READ_ONLY` cho **mọi** mutation Bronze/Silver/Gold hiện tại. Toàn bộ pipeline write path **đang bị chặn bởi config**.

### 2.6 DuckDB — **KHÔNG WRITE ĐƯỢC DELTA**

Probe thực thi trên `apps/api` (duckdb `1.5.6-r.1`):

```
duckdb_extensions(): delta → installed:true, loaded:false
duckdb_functions() filter 'delta%':
  delta_domain_metadata, delta_filter_pushdown_log, delta_get_transaction_version,
  delta_list_files, delta_scan, delta_set_transaction_version   ← CHỈ ĐỌC
COPY probe TO 's3://...' (FORMAT DELTA)
  → Catalog Error: Copy Function with name delta does not exist! Did you mean "blob"?
COPY probe TO 's3://...' (FORMAT PARQUET)
  → PARQUET WRITE OK
```

**Kết luận quyết định:** DuckDB `delta` extension là **read-only**. Không thể tạo Delta transaction log. Mọi `CREATE OR REPLACE TABLE 's3://lakehouse/...'` trong Silver/Gold **không tạo ra Delta commit** — đó là root cause thật của R-03, không phải lỗi syntax.

**API surface (verified):**

| Object | Methods |
|---|---|
| `DuckDBInstance` | `connect`, `closeSync` |
| `DuckDBConnection` | `closeSync`, `disconnectSync`, `run`, `runAndReadAll`, `prepare`, `createAppender`, … (**không có `close`**) |

→ Fix DQ-003 phải dùng `conn.closeSync()`, không phải `conn.close()`.

### 2.7 API surface hiện tại

**105 `route.ts`** (khớp MASTER PLAN §15). Phân bố:

| Domain | Routes | Ghi chú |
|---|---|---|
| airflow | 12 | **Thiếu route task logs** (R-14 confirmed) |
| bronze | 14 | ingest csv/json/stream + jobs + stats |
| catalog | 13 | ✅ provider-aware (`usesDatabricks()` branch) |
| crawler | 11 | |
| dq | 8 | summary/presets/rules/runs/run-suite |
| gold | 12 | + queries/* (4 business queries) |
| gold-queries | — | `sql-guard.ts` blacklist + 4 file `.sql` |
| health | 3 | `/health`, `/health/deep` |
| info | 1 | |
| kafka | 11 | incl. `reset-offset` (dangerous) |
| silver | 12 | |
| **EDA** | **0** | ❌ Chưa tồn tại |
| **Operations** | **0** | ❌ Chưa tồn tại |
| **Dashboard** | **0** | ❌ Chưa tồn tại |
| **Datasets** | **0** | ❌ Chưa tồn tại |

### 2.8 Frontend state

| Hạng mục | Hiện trạng |
|---|---|
| Screens | 12 (`home, catalog, bronze, silver, gold, crawler, kafka, airflow, dq, health, schematic`) + `settings` (route có, không render) |
| `components/eda/` | ❌ **Placeholder duy nhất**: `export const EDA_PLACEHOLDER = true;` |
| `components/charts/` | ❌ **Placeholder duy nhất**: `export const CHARTS_PLACEHOLDER = true;` |
| Chart library | ❌ **KHÔNG CÓ** trong `package.json` (chỉ three.js / drei / fiber cho RAG 3D) |
| `components/dq/` | 6 file thật: `dq-rule-card`, `dq-rule-detail`, `dq-run-list`, `dq-suite-form`, `dq-summary-bar` |
| `components/home/` | 10 file, nhưng `activity-feed` nhận `HOME_ACTIVITY` hardcode `[]` |
| Routing | `ROUTES` flat, `NAV_ROUTES` 11 mục. Chưa có nested DQ route |
| i18n | `src/i18n/locales` + `config.ts` — có EN/VI |
| State | TanStack Query + Zustand ✅ |
| Validation | Zod ✅ (`src/schemas/`) |

### 2.9 Security posture — **ZERO AUTH**

| Kiểm soát | Trạng thái | Bằng chứng |
|---|---|---|
| Authentication | ❌ **KHÔNG CÓ** | `middleware.ts` chỉ gọi `withCors` |
| Authorization / RBAC | ❌ **KHÔNG CÓ** | Không có role/permission check ở bất kỳ mutation route nào |
| Rate limit | ⚠️ **Có code nhưng KHÔNG dùng** | `with-rate-limit.ts` tồn tại, `grep` toàn repo chỉ ra definition + export — **không route nào áp dụng** |
| Input validation | ✅ Zod | Đã dùng rộng rãi |
| Audit logging | ❌ Không có actor/scope log cho mutation | |
| Secrets protection | ✅ Server-only | `DATABRICKS_TOKEN` không log; không in giá trị secret vào ledger |
| SQL injection (ad-hoc) | ⚠️ Blacklist keyword | `gold-queries/repositories/sql-guard.ts` — blacklist 21 keyword + 3 pattern |
| SQL injection (DQ custom_sql) | ❌ **Blacklist yếu hơn** | `dq.executor.ts:239` — chỉ 6 keyword |
| Airflow `docker.sock` | ❌ Mount vào cả webserver + scheduler | `docker-compose.yml` |

### 2.10 Worker topology

| Worker | Manager | Được start bởi `workers/main.ts`? |
|---|---|---|
| Crawler | `CrawlerWorkerManager` | ✅ Có |
| **Bronze** | `BronzeWorkerManager` | ❌ **KHÔNG** |
| **Silver** | `SilverWorkerManager` | ❌ **KHÔNG** |
| **Gold** | `GoldWorkerManager` | ❌ **KHÔNG** |

`apps/api/src/workers/main.ts:21-25` chỉ gọi `CrawlerWorkerManager.startAll()` → R-04 confirmed.

BullMQ queue state trong Redis: `redis-cli --scan` chỉ có `lakehouse::crawler-run:*` — **không có queue `bronze-ingest`/`silver-transform`/`gold-aggregate`**, tức là các worker đó chưa từng đăng ký.

---

## 3. Baseline test evidence

```
$ cd apps/api && pnpm exec vitest run --reporter=basic
 Test Files  16 passed (16)
      Tests  77 passed (77)
   Duration  1.74s
```

| Test file | Tests | Ghi chú |
|---|---|---|
| `databricks.test.ts` | 11 | |
| `kafka.test.ts` | 8 | **Chứa fix Kafka chưa commit** |
| `dq.test.ts` | 6 | |
| `airflow.test.ts` | 6 | |
| `bronze.test.ts` | 5 | |
| `gold.test.ts` | 5 | |
| `crawler.test.ts` | 5 | |
| `airflow-transport.test.ts` | 4 | |
| `silver.test.ts` | 4 | |
| `runtime-boundaries.test.ts` | 3 | *(untracked — mới)* |
| `bronze-execution.test.ts` | 3 | Assert executor **phải throw** → sẽ phải cập nhật khi implement thật |
| `bronze-routing.test.ts` | 3 | |
| `transport.test.ts` | 3 | |
| `airflow-stats.test.ts` | 2 | |
| `health-readiness.test.ts` | 2 | |

**Baseline = GREEN 77/77. Đây là mốc regression bắt buộc cho mọi phase sau.**

---

## 4. Verified API responses (live, 2026-10-24)

| Endpoint | HTTP | Body (abridged) |
|---|---|---|
| `GET /api/health` | 200 | `status:"ok"`, 7 services `skipped` (deep-only) |
| `GET /api/health/deep` | 200 | `status:"degraded"` — Mongo up 11ms, Redis up 21ms, DuckDB up 93ms, MinIO up 28ms, Kafka up 2ms, Airflow up 83ms, **Databricks degraded (STOPPED)** |
| `GET /api/kafka/cluster` | 200 | `clusterId:"redpanda.727c…", brokers:1, topicsCount:0, consumerGroupsCount:0` |
| `GET /api/kafka/topics` | 200 | `topics:[], count:0` |
| `GET /api/catalog/databases` | 200 | 4+ databases, `source:"databricks"` |
| `GET /api/dq/summary` | 200 | `{totalRules:0, enabledRules:0, totalRuns:0, **passRate:1**}` ← **FALSE SUCCESS** |
| `GET /api/airflow/dags` | 200 | `total:1`, `retail_elt_dag`, `isPaused:true` |
| `GET /api/bronze/jobs/stats` | 200 | `{total:0, queued:0, running:0, completed:0, failed:0, …}` |

---

## 5. Verified defects (chưa sửa — backlog Phase 1+)

| ID | Severity | Location | Defect | Plan ref |
|---|---|---|---|---|
| D-01 | **P0** | `bronze/workers/bronze-executors.ts:3-16` | Cả 3 executor `throw new Error('…not implemented')` | R-02 |
| D-02 | **P0** | `workers/main.ts:21-25` | Chỉ start CrawlerWorkerManager | R-04 |
| D-03 | **P0** | `dq/executors/dq.executor.ts:105` | `fetchSample(conn, path, ident, 'IS NULL')` → SQL `WHERE IS NULL` | DQ-002 |
| D-04 | **P0** | `dq/executors/dq.executor.ts` (6 handler) | `finally {}` rỗng → **rò rỉ DuckDB connection** | DQ-003 |
| D-05 | **P0** | `dq/executors/dq.executor.ts:239` | `custom_sql` chỉ blacklist 6 keyword | DQ-004 |
| D-06 | **P0** | `dq/executors/dq.executor.ts:185-196` | `unique` loại NULL khỏi total → mẫu số sai | DQ-005 |
| D-07 | **P0** | `dq/executors/dq.executor.ts` range/in_set/regex | denominator = total rows (gồm null), không tách skippedRows | DQ-006 |
| D-08 | **P0** | `dq/services/dq.service.ts:316` | `passRate = totalAgg > 0 ? … : 1` → 0 run ra **100%** | DQ-007 |
| D-09 | **P0** | `dq/services/dq.service.ts:154-180` | `runSuite` chạy tuần tự **đồng bộ trong HTTP request** | DQ-008 |
| D-10 | **P0** | `dq/executors/dq.executor.ts:5-13` | Hard-code `s3://lakehouse/{layer}/{table}` — **thiếu segment `{database}`**, khác `bronze/silver/gold` repo (`s3://lakehouse/{layer}/{database}/{table}`) | DQ-001 |
| D-11 | **P0** | `silver/repositories/duckdb.repository.ts:286`, `gold/…:238` | `CREATE OR REPLACE TABLE 's3://…'` → ghi **Parquet thô, không có `_delta_log`** | R-03 |
| D-12 | **P0** | `silver/…`, `gold/…`, `bronze/…/duckdb.repository.ts` | 3 file lặp lại `buildS3Path()` + `escapeS3Path()` — không có resolver chung | §10.1 |
| D-13 | **P0** | `middleware.ts` | Không auth; `withRateLimit` không route nào dùng | R-06 |
| D-14 | **P0** | `dq/repositories/models/dq-rule-run.model.ts` | Thiếu `provider`, `datasetId`, `deltaVersion`, `evaluatedRows`, `skippedRows`, `coverageRate` | §06.1 |
| D-15 | **P0** | `web/services/queries/home.queries.ts:36-37` | `records24h` cộng Bronze+Silver+Gold (double count) + label sai "all time" | R-10 |
| D-16 | **P1** | `web/screens/home/home.constants.ts` | `HOME_ACTIVITY = []` hardcode | §01 |
| D-17 | **P1** | `web/services/queries/home.queries.ts:22` | 8 request fan-out thay vì 1 summary endpoint | §08.1 |
| D-18 | **P1** | `app/api/airflow/dags/[dagId]/runs/[runId]/tasks/` | **Thiếu route `/{taskId}/logs`** | R-14 |
| D-19 | **P1** | `web/package.json` | Không có chart library | R-13 |
| D-20 | **P1** | `web/components/eda/index.ts`, `components/charts/index.ts` | Placeholder | §10.3 |
| D-21 | **P1** | `catalog/services/table.service.ts` | `buildTableId` = `{layer}.{database}.{name}` nhưng Databricks dùng `workspace.schema.name` → **2 ID scheme khác nhau** | R-01 |
| D-22 | **P1** | `docker-compose.yml` | `spark-master`/`spark-worker` build từ `Dockerfile.spark-runtime` nhưng image chưa build | §12 |
| D-23 | **P1** | `docker-compose.yml` | Airflow dùng base image thay vì `lake-airflow:2.7.0` → 3 DAG import error | §12 |
| D-24 | **P1** | `docker-compose.yml` | Mount `/var/run/docker.sock` vào webserver + scheduler | R-07 |
| D-25 | **P1** | `data-samples/` | **Không tồn tại** → `retail_elt_dag` sẽ ingest 0 row | R-09 |
| D-26 | **P1** | `bronze/queues/bronze.queue.ts:53-59` | `cancel()` = `job.remove()` — xóa record, **không dừng worker** | §09.1 |
| D-27 | **P1** | `dq/executors/dq.executor.ts` | `passRate = total>0 ? … : 1` — 0 row → 100% | DQ-006 |
| D-28 | **P2** | `lib/infra/duckdb/client.ts:17-18` | `INSTALL httpfs/delta` mỗi cold start (network) | §07.1 |
| D-29 | **P2** | `gold-queries/repositories/duckdb.repository.ts:75,92` | Nối chuỗi `segment`/`category` vào SQL không escape | §13.2 |
| D-30 | **P2** | `dq/executors/dq.executor.ts` | `limit` option không được dùng để bound scan | §13.7 |

### 3.1 Path/Provider mismatch (critical, chưa có trong danh sách trên)

| Tầng | Path convention | Nhận xét |
|---|---|---|
| Python (`src/lakehouse/core/paths.py`) | `s3a://{layer}/` (bucket = layer, KHÔNG có `database`) | e.g. `s3a://bronze/crm/customers/` |
| TS Bronze/Silver/Gold repo | `s3://lakehouse/{layer}/{database}/{table}` | bucket = `lakehouse`, CÓ `database` |
| TS DQ executor | `s3://lakehouse/{layer}/{table}` | bucket = `lakehouse`, **THIẾU `database`** |

→ **Ba convention khác nhau.** DuckDB đọc `s3://`, Spark đọc `s3a://`, và bucket khác nhau. Đây là nguyên nhân gốc khiến dữ liệu Python ghi vào `bronze/` không bao giờ hiện trong UI đọc `lakehouse/bronze/`. **PHASE 1 phải chuẩn hoá một `DatasetResolver` duy nhất.**

---

## 6. PHASE 0 Exit Gate — ĐÁNH GIÁ

| Gate | Yêu cầu | Kết quả | Evidence |
|---|---|---|---|
| G0.1 | Không nhầm lẫn checkout hiện tại vs archive | ✅ PASS | HEAD `1feadc1` + 13 file modified đọc diff đầy đủ |
| G0.2 | Không overwrite Kafka fix | ✅ PASS | Kafka fix được đọc, hiểu và giữ nguyên; không sửa file Kafka trong Phase 0 |
| G0.3 | Auth/network/storage known | ✅ PASS | §2.1–2.6, không có auth; storage rỗng; network OK |
| G0.4 | Kafka fix validated | ✅ PASS | `GET /api/kafka/cluster` 200, broker up 2ms, 77/77 test green |
| G0.5 | Regression baseline preserved | ✅ PASS | 16 files / 77 tests PASS ghi nhận |
| G0.6 | DAG import error explained | ✅ PASS | 3 lỗi, root cause = base image thiếu `delta`/`kafka`/`pyspark` |
| G0.7 | Dataset providers phân biệt | ✅ PASS | `local_delta_minio` vs `databricks_uc` đã map đầy đủ; phát hiện path mismatch |
| G0.8 | API inventory + risk register | ✅ PASS | 105 routes, 30 defects, 16 risk register |
| G0.9 | Không tự ý thay đổi dữ liệu | ✅ PASS | Chỉ đọc + 1 probe ghi vào `s3://lakehouse/_probe/` (đã xóa) |

### **PHASE 0 — EXIT GATE: ✅ PASS**

**Kết luận:** Baseline đã được đóng băng bằng bằng chứng thực thi. 30 defect được phân loại theo severity với file:line chính xác. Ba phát hiện quyết định kiến trúc cần xử lý ngay ở Phase 1:

1. **DuckDB không ghi được Delta** → writer phải là Spark (Python) hoặc `delta-rs`; DuckDB chỉ đọc.
2. **Ba path convention không khớp** → cần `DatasetResolver` chung.
3. **`LAKEHOUSE_DATA_SOURCE=databricks` chặn mọi mutation** → phải tách `dataSource` (read) khỏi `executionTarget` (write).

**Next action:** PHASE 1 — Core Correctness, Storage & Security.

---

## 7. Checkpoint Log

| # | Timestamp (UTC+7) | Phase | Event |
|---|---|---|---|
| 1 | 2026-10-24 20:59 | 0 | MASTER PLAN đọc đầy đủ 1007 dòng (Section 00–17) |
| 2 | 2026-10-24 21:02 | 0 | Git audit: `dev-v3` @ `1feadc1`, 13 file modified |
| 3 | 2026-10-24 21:02 | 0 | Baseline test: 77/77 PASS |
| 4 | 2026-10-24 21:03 | 0 | Runtime audit: 7 container healthy, storage rỗng, 3 DAG import error |
| 5 | 2026-10-24 21:05 | 0 | DuckDB probe: delta extension read-only; `closeSync` là API đúng |
| 6 | 2026-10-24 21:06 | 0 | Path mismatch phát hiện (3 convention) |
| 7 | 2026-10-24 21:08 | 0 | Ledger + Gap Register + Risk Register viết xong |

---

## 8. PHASE 7/8 — Home KPI, Activity, Schematic Overlay & Cross-Stack Verification

> **Cập nhật:** 2026-10-25 · Nhánh `dev-v3` @ `1feadc1` · Working tree: 248 modified, 1 deleted, 72 untracked.
> **Bằng chứng:** toàn bộ số liệu dưới đây là output thật của `vitest` / `tsc` / `eslint` / `pytest` trong phiên này.

### 8.1 Defect nghiêm trọng phát hiện khi viết test contract của cursor

Việc viết test cho activity cursor đã lộ ra **hai lỗi correctness thật**, cả hai đều gây *mất event âm thầm* — loại lỗi mà một kiểm tra status-code không bao giờ bắt được:

| ID | Mức độ | Vị trí | Lỗi | Hậu quả |
|---|---|---|---|---|
| **D-31** | **P0** | `security/repositories/audit.repository.ts:63` | Bound của cursor là ISO **string**, nhưng `audit_events.createdAt` lưu là BSON **`Date`** | MongoDB so sánh theo thứ tự BSON type: mọi `Date` đứng trước mọi `String`, nên `$lte: '<iso>'` **không match row nào**. Toàn bộ audit event **biến mất sau trang 1** của activity feed. |
| **D-32** | **P0** | `operations/…:213`, `security/…:63` | Cursor chỉ theo timestamp, không theo id | Nhiều event cùng một mili-giây (rất thường xuyên với audit burst). Bound *exclusive* làm rơi các event anh em cùng timestamp; bound *inclusive* đọc lại cả nhóm và **âm thầm mất** các thành viên nằm ngoài cửa sổ fetch. |

**Cách sửa:** chuyển sang **compound keyset `(at, id)`**:

- Thêm `apps/api/src/lib/pagination/keyset.ts` — định nghĩa thứ tự toàn cục `(at DESC, id DESC)` với id có prefix nguồn (`op:` / `audit:`), và `sourceBoundary()` suy ra biên của *từng nguồn* từ cursor chung.
- `OperationFilter.before` / `AuditListFilter.before` đổi từ `string` → `KeysetBoundary` (`before-at` | `at-or-before` | `compound`).
- `operations.createdAt` là **String** → so sánh lexicographic trên ISO-8601 (đúng thứ tự thời gian, không cần cast).
- `audit_events.createdAt` là **Date** → bound phải là `new Date(at)`.
- Index mới: `{createdAt: -1, operationId: -1}` và `{createdAt: -1, eventId: -1}` — không có index này thì push-down lại thành collection scan + in-memory sort.

**Bằng chứng:** `tests/integration/dashboard-activity.test.ts` (7 test) + `tests/unit/keyset.test.ts` — assert cả ba tính chất: không lặp event, không mất event, bound push-down đúng tới **cả hai** nguồn.

### 8.2 Schematic overlay — từ "sơ đồ tĩnh" sang trạng thái thật

Trước đây `/schematic` là một scene 3D **trang trí**: `recordsValue: '—'`, `latencyValue: '—'`, và i18n ghi rõ *"Static architecture illustration; no live metrics are collected here."* Phase 7 yêu cầu *"timeline/lineage overlay on Schematic"*.

| Hạng mục | Trước | Sau |
|---|---|---|
| Nguồn số liệu | Không có | `stageStates` trong `GET /api/dashboard/summary` — **cùng read model** với KPI card, nên schematic không thể mâu thuẫn với card bên cạnh |
| Backend | — | `measureStageStates()` đọc operations **một lần**, chia theo `STAGE_MEMBERSHIPS` (catalog = silver+gold; storage = mọi stage ghi data) |
| Node 3D | glow cố định | `running` → glow mạnh + nhịp; `failed` → viền đỏ; `healthy`/`idle`/`degraded` phân biệt rõ |
| Inspector | chỉ in dòng "static" | health tag + running count + last operation + status + thời gian tương đối |
| Missing data | `—` | `—` (không phải `0`) — "chưa có dữ liệu" khác "0 bản ghi" |

**Bằng chứng:** `apps/web/src/components/__tests__/schematic-overlay.test.ts` (12 test) — assert `unavailable` khi summary lỗi, không rò pass rate của stage khác, `not_evaluated` không bao giờ thành 0%.

### 8.3 Các gap khác đã đóng trong phiên này

| ID | Mức độ | Vị trí | Lỗi | Cách sửa |
|---|---|---|---|---|
| **D-33** | **P0** | `operations/services/operation.service.ts:192` | `cancel()` nhận `owner` nhưng **không hề dùng** — bất kỳ principal nào có `job:cancel` cũng cancel được operation của người khác | Thêm `assertOwner()`: user bị ràng buộc vào operation mình tạo; `service`/`anonymous` không bị ràng buộc (nếu không thì synthetic principal sẽ bị khoá khi auth tắt). Áp dụng cho cả `retry()`. |
| **D-34** | P1 | `dashboard/services/dashboard.service.ts` | `window` param được nhận nhưng **bị bỏ qua** — quality luôn là "all-time" | `DqSummaryService.summary(window)` với `all` \| `24h`; `runMatch` áp cho **mọi** aggregation (passRate, byLayer, byStatus, denominator) để không trộn window. Window lạ → fallback `all` (không âm thầm ép về `24h`). |
| **D-35** | P1 | `dashboard/services/dashboard.service.ts` | `STALE_AFTER_MS` khai báo nhưng **không dùng** — không có stale indicator | `metric()` tự đánh dấu `stale` khi `asOf` cũ hơn 60s. Tuổi đo từ `asOf` của chính measurement, không phải từ "bây giờ" — re-stamp bằng `now` sẽ giấu tuổi thật. |
| **D-36** | P2 | `operations/repositories/models/operation.model.ts:26` | `idempotencyKey` có `index: true` **và** `schema.index({idempotencyKey:1}, {unique, partial})` → Mongoose tạo index 2 lần | Bỏ `index: true` ở field level, giữ partial unique index. Warning đã hết. |
| **D-37** | P2 | `operations/repositories/models/operation.model.ts` | Thiếu index cho sort của keyset | Thêm `{createdAt:-1, operationId:-1}` (operations) và `{createdAt:-1, eventId:-1}` (audit). |

### 8.4 Cross-stack verification (Phase 8)

```
$ cd apps/api && pnpm run typecheck          → PASS (no output)
$ cd apps/api && pnpm run lint               → PASS (0 error; chỉ còn warning no-console ở script CLI)
$ cd apps/api && pnpm exec vitest run        → 22 files / 142 tests PASS
$ cd apps/web && pnpm run typecheck          → PASS
$ cd apps/web && pnpm exec vitest run        → 15 files / 102 tests PASS
$ python3 -m pytest tests/ -q                → 252 passed, 6 skipped
```

**So sánh với baseline Phase 0:**

| Chỉ số | Baseline (24/10) | Hiện tại (25/10) | Chênh lệch |
|---|---|---|---|
| API test files | 16 | 22 | +6 |
| API tests | 77 | 142 | +65 |
| Web test files | 0 (jsdom thiếu) | 15 | +15 |
| Web tests | 0 | 102 | +102 |
| Python tests | 192 passed | 252 passed, 6 skipped | +60 |
| API lint errors | không đo | 0 | — |

### 8.5 Trạng thái Phase 7/8

| Phase | Trạng thái | Ghi chú |
|---|---|---|
| **7** | ✅ **PASS** (về read model + overlay) | Summary/activity backend read model có provenance + partial + stale; `recordsProcessed` = Bronze committed rows (không cộng 3 layer); Schematic overlay dùng chung read model. **Còn thiếu:** FE chưa có selector đổi quality window, và stale indicator chưa render phân biệt trên Home. |
| **8** | 🟡 **PARTIAL** | Cross-stack verification xanh (typecheck + lint + test 3 stack). **Còn thiếu:** benchmark reproducible, load test, feature flag, progressive deploy, runbook production — theo MASTER PLAN §11 PHASE 8. Không được ghi `PRODUCTION VERIFIED`. |

### 8.6 Việc còn lại cụ thể

- [ ] FE: selector `Last 24h / All history` cho quality pass rate (API đã hỗ trợ `?window=`, FE chưa gửi).
- [ ] FE: render `stale` khác `unavailable` trên Home card (API đã trả `status: 'stale'`).
- [ ] FE: activity feed nối `nextCursor` thành "load more" (cursor đã đúng sau D-31/D-32).
- [ ] Phase 8: benchmark reproducible (nhiều lần chạy lặp + CI + confounder log), load test, feature flag, progressive deploy, rollback test, runbook operator.
- [ ] `PRODUCTION VERIFIED` **không** được ghi khi chưa có bằng chứng ở môi trường mục tiêu (MASTER PLAN §00.3).
