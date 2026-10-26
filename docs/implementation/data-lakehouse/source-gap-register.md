# Source Gap Register — Data Lakehouse Control Plane

**Baseline:** `dev-v3` @ `1feadc1` — 2026-10-24
**Nguồn:** đọc source thật + probe runtime thật (không suy đoán từ plan)

Legend: `❌ MISSING` · `🟡 PARTIAL` · `✅ PRESENT` · `⚠️ PRESENT-BUT-WRONG`

---

## 1. Backend — Modules

| Module | Trạng thái | Bằng chứng | Ghi chú |
|---|---|---|---|
| `airflow` | 🟡 PARTIAL | 12 routes; `AirflowTaskRepository.logs()` **có** nhưng **không có route** | Thiếu `GET .../tasks/{taskId}/logs` |
| `bronze` | 🟡 PARTIAL | Service+Queue+Repo đầy đủ; **3 executor throw `not implemented`** | Không có worker process start |
| `catalog` | ✅ PRESENT | `usesDatabricks()` branch đúng; `duckdb.repository.ts` có `getTableInfo` | `buildTableId` scheme khác Databricks `full_name` |
| `crawler` | ✅ PRESENT | 11 routes + worker manager được start | |
| `dq` | 🟡 PARTIAL | CRUD đủ; executor có **4 bug logic** | Summary trả `passRate:1` khi 0 run |
| `gold` | 🟡 PARTIAL | Worker/Queue/Repo đủ | `CREATE OR REPLACE TABLE 's3://'` → không có `_delta_log` |
| `gold-queries` | ✅ PRESENT | 4 file `.sql` + `sql-guard.ts` | SQL filter nối chuỗi không escape |
| `health` | ✅ PRESENT | `/health` + `/health/deep` | `/health` skip tất cả dependency (deep-only) |
| `kafka` | ✅ PRESENT | 11 routes, admin/producer/consumer đã fix | `reset-offset` không có RBAC |
| `silver` | 🟡 PARTIAL | Như gold | Cùng lỗi Delta write |
| **`datasets`** | ❌ MISSING | — | **PHASE 1 — `DatasetResolver`** |
| **`operations`** | ❌ MISSING | — | **PHASE 2** |
| **`eda`** | ❌ MISSING | — | **PHASE 5** |
| **`dashboard`** | ❌ MISSING | — | **PHASE 7** |

## 2. Backend — Infrastructure

| Hạng mục | Trạng thái | Bằng chứng |
|---|---|---|
| Mongo | ✅ | `mongo:7.0` up, `connectionState:1` |
| Redis / BullMQ | ✅ | `redis:7.2-alpine` up, `ping:PONG` |
| DuckDB | 🟡 | `delta` extension installed; **`delta` writer KHÔNG tồn tại**; `COPY FORMAT DELTA` → Catalog Error |
| DuckDB conn cleanup | ⚠️ | `conn.closeSync()` tồn tại; **DQ executor không gọi** (6 `finally {}` rỗng) |
| Kafka admin/producer | ✅ | Fix uncommitted giữ nguyên, cache `Promise<Admin>` chống race |
| Airflow client | ✅ | Basic auth, timeout, `AppError` mapping 401/403/5xx |
| Databricks client | ✅ | `remoteReadOnly()`, `readStatement()` có deadline 25s + rowLimit 1000 |
| S3 secret | ✅ | `CREATE SECRET object_storage_secret` trong DuckDB init |

## 3. Backend — Security

| Kiểm soát | Trạng thái | Chi tiết |
|---|---|---|
| AuthN | ❌ MISSING | `middleware.ts` chỉ `withCors` |
| AuthZ / RBAC | ❌ MISSING | Không có check role ở bất kỳ route mutation |
| Rate limit | ⚠️ | `with-rate-limit.ts` có, **0 route dùng** |
| Audit log | ❌ MISSING | Không ghi actor/scope |
| Input validation | ✅ | Zod xuyên suốt 105 routes |
| SQL guard (ad-hoc) | 🟡 | Blacklist 21 keyword + 3 pattern — chưa có AST |
| SQL guard (DQ `custom_sql`) | ⚠️ | Blacklist **chỉ 6** keyword |
| Secrets | ✅ | Không log token; ledger chỉ ghi `<set>` |
| Docker socket | ⚠️ | Mount vào Airflow webserver + scheduler |

## 4. Frontend

| Hạng mục | Trạng thái | Chi tiết |
|---|---|---|
| Home | 🟡 | 8-request fan-out; `records24h` double-count; `HOME_ACTIVITY=[]` |
| Catalog / Bronze / Silver / Gold | 🟡 | Có screen + service + query; thiếu trạng thái provider + version |
| Kafka | ✅ | Schema/adapter đã relax cho API thật (offset string) |
| Airflow | 🟡 | Có trigger; thiếu task-logs route phía BE |
| DQ | 🟡 | 2 tab `rules`/`runs`; **chưa có Explore/EDA**, chưa có suites/gates/failed samples |
| Health / Schematic | 🟡 | Schematic dựng topology từ FE, chưa có API graph |
| **`components/eda/`** | ❌ | `export const EDA_PLACEHOLDER = true;` |
| **`components/charts/`** | ❌ | `export const CHARTS_PLACEHOLDER = true;` |
| Chart library | ❌ | Không có trong `package.json` |
| i18n EN/VI | ✅ | `src/i18n/locales` + `config.ts` |
| Query cache | ✅ | TanStack Query, `QUERY_KEYS` scoped |
| Zod decode | ✅ | `services/*/*.adapter.ts` pattern nhất quán |
| Design system | ✅ | `ScreenPageHeader`, `ScreenSection`, `GlassCard`, `EmptyState`… |

## 5. Python / Airflow / Infra

| Hạng mục | Trạng thái | Chi tiết |
|---|---|---|
| `src/lakehouse/core/paths.py` | ⚠️ | Path = `s3a://{layer}/` — **không khớp** `s3://lakehouse/{layer}/{db}/{table}` của TS |
| `src/lakehouse/core/spark.py` | ✅ | `configure_spark_with_delta_pip`, S3A config, `txnVersion/txnAppId` |
| `src/lakehouse/storage/delta_writer.py` | ✅ | `write_delta_table`, `quarantine_bad_records`, `write_delta_streaming` (at-least-once, có doc) |
| `ingest/batch/csv_ingestor.py` | ✅ | Dedup natural key, append mode, mergeSchema |
| `ingest/batch/json_ingestor.py` | ✅ | *(cần verify chi tiết)* |
| `ingest/streaming/` | ✅ | 3 streaming ingestor + 3 transformer + 2 metrics aggregator |
| `transform/batch/` | ✅ | customers/products/orders transformer |
| `aggregate/batch/` | ✅ | fact_orders, dim_customers, dim_products, daily_revenue |
| `quality/checks.py` | ✅ | PySpark quality routines |
| `pipelines/batch_retail.py` | ✅ | `BatchRetailPipeline` |
| **`profiling/`** | ❌ | Chưa có → **PHASE 5** |
| **`jobs/`** | ❌ | Chưa có typed job CLI → **PHASE 1** nếu dùng Python worker |
| `airflow_dags/` | 🟡 | 4 DAG; **3 import error** (thiếu `delta`, `kafka`) |
| `data-samples/` | ❌ | **Không tồn tại** → DAG sẽ ingest 0 row |
| `lake-spark:3.5.6` image | ❌ | Chưa build |
| `lake-airflow:2.7.0` image | ❌ | Chưa build → container chạy base image |

---

## 6. Khoảng trống theo Phase (traceability tới MASTER PLAN)

| Phase | Gap ID | Bắt buộc đóng trước |
|---|---|---|
| **1** | D-01..D-14, D-26, D-27, path mismatch, `datasets` module | ✅ |
| **2** | `operations` module, `dashboard/activity`, job state registry | ✅ |
| **3** | D-18 (task logs route), trigger wizard, preflight | ✅ |
| **4** | Streaming wizard, checkpoint, DLQ, topic admin RBAC | ✅ |
| **5** | `eda` module, `profiling/` (nếu dùng Spark), chart API | ✅ |
| **6** | `components/eda`, chart library, DQ suites/gates/failed-samples | ✅ |
| **7** | D-15..D-17, `dashboard` module, lineage graph API | ✅ |
| **8** | Benchmark harness, feature flags, rollback | ✅ |
