# Lakehouse Backend API

> Control plane API cho data lake medallion (Bronze / Silver / Gold) + Crawlers / Data Quality / Airflow / Kafka.

Backend Next.js 15 (App Router) + TypeScript thuần, kiến trúc 4 tầng tách biệt (route → controller → service → repository), sử dụng DuckDB, MongoDB, Redis, S3-compatible (MinIO), kafkajs, BullMQ.

## Tech Stack

| Layer        | Tech                                                |
| ------------ | --------------------------------------------------- |
| Runtime      | Node.js 22, TypeScript 5.7                          |
| Framework    | Next.js 15 (App Router, Route Handlers)             |
| Validation   | Zod                                                 |
| API docs     | next-swagger-doc + swagger-ui-react                 |
| SQL engine   | `@duckdb/node-api` (delta_scan trực tiếp trên S3)   |
| NoSQL        | MongoDB qua `mongoose`                              |
| Cache/Queue  | Redis + BullMQ (`ioredis`)                          |
| Streaming    | `kafkajs` (Admin / Producer / Consumer)             |
| Object store | MinIO (S3-compatible) qua `@aws-sdk/client-s3`      |
| Scheduler    | Apache Airflow REST API (HTTP proxy)                  |

## Kiến trúc 4 tầng

```
┌──────────────────────────────────────────────────────────────┐
│  Route  (apps/api/src/app/api/<module>/<path>/route.ts)      │
│  - HTTP only: parse query/body, call Controller, return JSON │
└──────────────┬───────────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────────┐
│  Controller  (modules/<module>/controllers/*.controller.ts)   │
│  - 1 file / nhóm chức năng: nhận input từ Route → Service    │
└──────────────┬───────────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────────┐
│  Service  (modules/<module>/services/*.service.ts)           │
│  - Orchestration + translate Infra errors → AppError         │
└──────────────┬───────────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────────┐
│  Repository / Executor / Infra singleton                     │
│  - repositories/: giao tiếp DuckDB, MongoDB, Kafka, Airflow  │
│  - executors/: rule runner (DQ)                              │
│  - lib/infra/*: process-singleton client                     │
└──────────────────────────────────────────────────────────────┘
```

Quy tắc bắt buộc:

- **1 file = 1 trách nhiệm** — không gộp nhiều logic vào cùng layer.
- **Không comment, không icon** trong source code (trừ JSDoc OpenAPI trên route handlers).
- **Barrel exports** — mỗi thư mục có `index.ts` re-export, import qua barrel (`@/modules/<m>`).
- **Layer purity** — controller không gọi trực tiếp repository, service không gọi controller, v.v.

## Modules

| Module   | Endpoints | Mục đích                                                                  |
| -------- | --------- | ------------------------------------------------------------------------- |
| catalog  | 20        | Database / schema discovery, lineage giữa Bronze/Silver/Gold              |
| bronze   | 14        | CRUD + ingest CSV/JSON/stream cho bảng Bronze (Delta trên MinIO)           |
| silver   | 14        | Transform + dedupe + time-travel cho bảng Silver                          |
| gold     | 18        | Aggregate + business SQL (revenue, customer analytics, ad-hoc sandbox)     |
| crawler  | 14        | Quản lý 5 crawlers (tiki, github, crypto, weather, hackernews) + BullMQ    |
| kafka    | 14        | Topics / producers / consumer groups / cluster / lag (kafkajs)            |
| airflow  | 13        | DAG CRUD + task logs + gantt + health/stats (REST proxy)                   |
| dq       | 11        | Data Quality rules CRUD + run/suite + summary + presets (DuckDB)          |
| health   | 4         | Liveness / readiness cho API + dependencies                              |
| **Tổng** | **122**   |                                                                           |

## Yêu cầu môi trường

- Node.js 22+
- Docker + Docker Compose (cho MinIO, MongoDB, Redis, Kafka, Airflow)
- pnpm hoặc npm

## Cài đặt nhanh

```bash
# 1. Từ thư mục root
cp .env.example apps/api/.env

# 2. Khởi động infrastructure (MinIO + Mongo + Redis + Kafka + Airflow)
docker compose up -d minio mongo redis kafka airflow-db

# 3. Cài dependencies cho API
cd apps/api
npm install

# 4. Dev mode
npm run dev

# 5. Truy cập Swagger UI
open http://localhost:3001/api/docs
```

## Scripts

| Lệnh                  | Mô tả                                                              |
| --------------------- | ------------------------------------------------------------------ |
| `npm run dev`         | Khởi động Next.js dev server (port 3001) + auto reload              |
| `npm run build`       | Build production bundle                                            |
| `npm run start`       | Chạy production server (cần `build` trước)                        |
| `npm run typecheck`   | TypeScript check only (`tsc --noEmit`)                            |
| `npm run lint`        | ESLint (next lint)                                                 |
| `npm run smoke:kafka` | Smoke test kết nối Kafka cluster (kafkajs admin)                  |

## Cấu hình (`.env`)

Tất cả env được validate bằng Zod (`apps/api/src/config/env.ts`) — sai format sẽ crash app lúc boot. Xem `apps/api/.env.example` để biết danh sách đầy đủ.

Các nhóm chính:

- **MinIO / S3**: `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_SECURE`
- **MongoDB**: `MONGO_URI`, `MONGO_DB`
- **Redis**: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- **Kafka**: `KAFKA_BOOTSTRAP`, `KAFKA_SECURITY_PROTOCOL`
- **Airflow**: `AIRFLOW_BASE_URL`, `AIRFLOW_USERNAME`, `AIRFLOW_PASSWORD`
- **DuckDB**: `DUCKDB_MEMORY_LIMIT`, `DUCKDB_THREADS`
- **API**: `API_PORT`, `API_RATE_LIMIT_PER_MIN`, `API_CORS_ORIGINS`, `API_SWAGGER_ENABLED`

## API documentation

- **Swagger UI**: `http://localhost:3001/api/docs`
- **OpenAPI JSON**: `http://localhost:3001/api/openapi.json`
- **Examples**: xem `apps/api/docs/api/` (curl + TypeScript fetch snippets cho từng nhóm endpoint).

## Đóng góp

1. Tuân thủ kiến trúc 4 tầng + barrel imports.
2. Mọi endpoint mới phải:
   - Có Zod schema validate input (`<module>/schemas/<...>.schema.ts`)
   - Có OpenAPI JSDoc block phía trên handler (xem các route hiện có làm mẫu)
   - Không chứa comment hay icon trong source code
   - Đi qua đủ các layer (route → controller → service → repository)
3. Chạy `npm run typecheck && npm run build` trước khi commit.
4. Một test smoke cho module mới trong `apps/api/src/modules/<module>/scripts/smoke-*.ts`.

## Troubleshooting

- **App crash lúc boot** → check log Zod env validation, thiếu hoặc sai `MINIO_*`, `MONGO_URI`, `REDIS_HOST`, `KAFKA_BOOTSTRAP`.
- **`MongoServerError: connection refused`** → `docker compose ps mongo`, restart container.
- **`S3 Credentials error` trong DuckDB query** → MinIO chưa được khởi tạo bucket, xem log "Bucket ... not found" và chạy bucket-init.
- **Kafka admin timeout** → `KAFKA_BOOTSTRAP` không trỏ đúng host (sửa thành `kafka:9092` khi chạy trong compose, `localhost:9092` khi dev ngoài).
- **Airflow 404** → chưa bật Airflow webserver/scheduler; xem `docker compose up airflow-webserver airflow-scheduler`.

## Phân tích thêm

- Plan tổng: `docs/plan/plan_overview/20-backend-nextjs-plan.md`
- Phases execution: `docs/plan/plan_overview/21-backend-phases-execution.md`
- Kiến trúc high-level: `docs/01-architecture-overview.md`
- Handoff checklist: `apps/api/HANDOFF.md`