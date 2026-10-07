# Architecture

## Tổng quan

Backend là một **Next.js 15 App Router** project (`apps/api`) làm control plane cho data lake medallion (Bronze / Silver / Gold). Mục tiêu chính:

1. **Inventory surface** — khám phá databases / tables / schema qua DuckDB `delta_scan` trực tiếp trên MinIO S3.
2. **Ingestion surface** — ingest CSV / JSON / stream (Kafka) qua REST API.
3. **Transformation surface** — chạy Spark / DuckDB transform Bronze → Silver → Gold, trigger jobs qua BullMQ.
4. **Orchestration surface** — proxy sang Airflow DAGs qua REST proxy.
5. **Observability surface** — Data Quality rules (DuckDB assertions), stats, gantt visualization.
6. **Streaming surface** — Kafka topics CRUD, produce / peek / consumer groups qua kafkajs.

## Kiến trúc 4 tầng (bắt buộc)

```
┌──────────────────────────────────────────────────────────┐
│  Layer 1 — Route Handler                           │
│  apps/api/src/app/api/<module>/<path>/route.ts  │
│                                                                 │
│  - Chỉ xử lý HTTP: req->get(), req->post(), etc.       │
│  - Validate input bằng Zod schemas                       │
│  - Gọi controller tương ứng                                 │
│  - Trả về response qua response-builder.ok()/error-builder │
│  - OpenAPI JSDoc block phía trên handler                 │
└──────────────────────────────┬───────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────┐
│  Layer 2 — Controller                                        │
│  apps/api/src/modules/<module>/controllers/                  │
│                                                                 │
│  - 1 file / nhóm chức năng (vd: dag.controller.ts            │
│    chỉ chứa logic cho DAG operations của Airflow module)    │
│  - Nhận input từ Route → gọi Service                        │
│  - Không gọi repository, không gọi infra trực tiếp         │
│  - Không có logic business phức tạp                          │
└──────────────────────────────┬───────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────┐
│  Layer 3 — Service / Executor                                 │
│  apps/api/src/modules/<module>/services/                    │
│  apps/api/src/modules/<module>/executors/                    │
│                                                                 │
│  - Service: orchestration, ghép nhiều repo, transform         │
│    kết quả trả về cho controller                              │
│  - Executor: chạy long-running actions (DQ rule runner,        │
│    BullMQ job manager, Kafka admin ops)                       │
│  - Translate errors từ infra layer → AppError                 │
│  - Không gọi controller, không gọi route                      │
└──────────────────────────────┬───────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────┐
│  Layer 4 — Repository / Infrastructure Singleton               │
│  apps/api/src/modules/<module>/repositories/                 │
│  apps/api/src/lib/infra/                                      │
│                                                                 │
│  - Repository: giao tiếp DuckDB / MongoDB / Kafka / Airflow │
│  - Infra Singleton: lazy-init client, hot-reload friendly     │
│    (DuckDB instance, Mongo connection, Redis client,         │
│     S3 client, Kafka admin/producer/consumer, Airflow client)│
│  - Không có business logic, chỉ wrap SDK call               │
└──────────────────────────────────────────────────────────────┘
```

## Quy tắc kiến trúc (không thể bẻ)

### 1. Layer purity

| Quy tắc                                         | Lý do                                                |
| ------------------------------------------------ | --------------------------------------------------- |
| Route KHÔNG gọi trực tiếp Service hoặc Repository | Giữ route mỏng, dễ test, dễ refactor service      |
| Controller KHÔNG gọi Repository                  | Buộc đi qua Service để có orchestration & error translate |
| Service KHÔNG gọi Controller hoặc Route         | Tránh vòng lặp & trộn tầng                       |
| Repository / Infra KHÔNG gọi Service              | Repo chỉ là data access, không có business logic   |
| Executor (DQ, Crawler Jobs) chỉ được gọi từ Service | Executor không thuộc route path                   |

### 2. 1 file = 1 trách nhiệm

- Không gộp "controller + executor + helper" vào 1 file.
- Không gộp "CRUD controller + stats controller" vào 1 file.
- Nếu 1 file có > 1 controller vì logic quá nhỏ → tách ra.

### 3. Barrel exports (bắt buộc)

Mỗi thư mục có code TS phải có `index.ts` re-export. Các file khác **KHÔNG được** import trực tiếp từ deep path, mà phải qua barrel:

```ts
// ĐÚNG
import { DagController } from '@/modules/airflow/controllers';

// SAI
import { DagController } from '@/modules/airflow/controllers/dag.controller';
```

### 4. Không comment, không icon

- Source code: **không có** inline comment, block comment, JSDoc giải thích.
- Ngoại lệ: JSDoc OpenAPI block phía trên route handler (cần thiết cho swagger).
- Markdown docs (`/apps/api/docs/api/*.md`, `README.md`, `HANDOFF.md`): markdown hợp lệ, không icon.
- Emoji/icon: **không** trong source code.

### 5. TypeScript strict

- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
- Không dùng `any` trừ khi boundary 3rd party không type-safe.
- Mọi `unknown` phải được narrow trước khi dùng.

## Module inventory

### catalog

- **Mục đích**: discovery database / table / schema trên MinIO Delta Lake.
- **Files**: `controllers/database.controller.ts`, `controllers/table.controller.ts`, `controllers/schema.controller.ts`, `services/database.service.ts`, `services/table.service.ts`, `services/schema.service.ts`, `services/search.service.ts`, `repositories/database.repository.ts`, `repositories/table.repository.ts`, `repositories/schema.repository.ts`.

### bronze

- **Mục đích**: lớp Bronze raw, ingest CSV / JSON / stream (Kafka), CRUD Delta tables.
- **Files**: 4 controllers, 4 services, 4 repositories, 4 schemas.

### silver

- **Mục đích**: dedupe / normalize Bronze → Silver, time-travel theo Delta version, diff giữa versions.
- **Files**: 3 controllers, 3 services, 3 repositories, 4 schemas.

### gold

- **Mục đích**: aggregate Silver → Gold, business SQL queries (revenue / customer analytics / product performance).
- **Files**: 4 controllers, 4 services, 5 repositories (gồm 5 SQL query wrapper repos), 4 schemas.

### crawler

- **Mục đích**: registry 5 crawlers (tiki / github / crypto / weather / hackernews), BullMQ worker queue, run sync/async.
- **Files**: 3 controllers, 1 service, 1 jobs queue manager, 1 mongo repository, 5 crawler implementations (1 base class + 5 concrete), 4 schemas.

### kafka

- **Mục đích**: kafkajs admin / producer / consumer CRUD topics, messages peek, lag, reset offset.
- **Files**: 3 controllers, 1 service, 4 repositories (topic / message / consumer-group / cluster), 1 kafkajs singleton, 3 schemas.

### airflow

- **Mục đích**: HTTP proxy sang Airflow REST API v1 — DAG CRUD, runs CRUD, task logs, gantt, health/stats.
- **Files**: 2 controllers (dag / task), 1 service, 4 repositories, 2 schemas.

### dq

- **Mục đích**: data quality rules (6 types: null_check, range_check, in_set, unique, regex, custom_sql) với DuckDB execution, MongoDB run history, summary dashboard, 6 preset rule templates.
- **Files**: 2 controllers (rule / summary), 4 services (rule / execution / run / summary), 1 executor (DuckDB), 2 repositories (rule / run), 3 schemas.

## Infra singletons (`apps/api/src/lib/infra/`)

| File                         | Purpose                                                   |
| ---------------------------- | --------------------------------------------------------- |
| `duckdb.client.ts`           | DuckDB instance, lazy init, set S3 secret + memory limit  |
| `mongo.client.ts`            | Mongoose connect, retry logic, hot-reload aware            |
| `redis.client.ts`            | ioredis singleton, used by BullMQ Queue / Worker           |
| `s3.client.ts`               | @aws-sdk/client-s3 S3Client, MinIO endpoint              |
| `kafkajs.client.ts`          | kafkajs Kafka, Admin / Producer / Consumer factory         |
| `airflow.client.ts`          | fetch wrapper with basic auth / bearer                    |
| `logger.ts`                  | pino instance                                              |
| `bullmq.connection.ts`       | ioredis connection cho BullMQ (chia sẻ với redis nếu cùng host) |

Tất cả singleton sử dụng **module-level lazy initialization** + `globalThis` cache để tránh tạo lại khi Next.js dev hot-reload.

## Cross-layer Flow (ví dụ: GET /api/catalog/tables)

```
Browser
  ↓ GET /api/catalog/tables?layer=bronze
Route Handler (apps/api/src/app/api/catalog/tables/route.ts)
  ↓ withErrorHandler(withRequestId(handler)) -> ok()
  ↓ Validate query bằng TableLayerQuerySchema
  ↓ await tableController.list(query)
Controller (modules/catalog/controllers/table.controller.ts)
  ↓ Throws AppError on invalid input
  ↓ await tableService.list(query)
  ↓ returns ServiceResult
Service (modules/catalog/services/table.service.ts)
  ↓ await databaseRepo.listDatabases() (caching layer)
  ↓ await tableRepo.list(query) -> DuckDB metadata query
  ↓ return ServiceResult<List<Table>>
Repository (modules/catalog/repositories/table.repository.ts)
  ↓ Build SQL: SELECT * FROM delta_scan('s3://lakehouse/{layer}/*/_delta_log/*')
  ↓ call infra singleton DuckDB
Infra (modules/infra/duckdb.client.ts)
  ↓ getInstance() -> module-singleton DuckDB instance
  ↓ Execute SQL, return rows[]
Response
  ↓ { data: [...rows], requestId, timestamp }
```

## Hot-reload safety

Next.js dev mode reload modules. Mỗi infra singleton cache instance trên `globalThis` để tránh rò rỷ:

```ts
const g = globalThis as unknown as { __duckdb?: DuckDB };
export function getDuckDB(): DuckDB {
  if (!g.__duckdb) g.__duckdb = new DuckDB();
  return g.__duckdb;
}
```

## Error translation

Mọi error từ infra layer được wrap qua `withErrorHandler` ở route level. Service layer dùng `AppError` cho lỗi business:

```ts
throw new AppError('TABLE_NOT_FOUND', 404, { tableId });
```

`Error` middleware sẽ:

1. Match `AppError` → trả `{ error: { code, message, status } }` đúng status.
2. Match `ZodError` → trả 400 với field-level details.
3. Other → trả 500 `INTERNAL_ERROR` + log full stack.