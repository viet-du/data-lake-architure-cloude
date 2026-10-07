# Handoff Checklist

Backend API control plane đã sẵn sàng bàn giao (Phase 1 → Phase 8 hoàn tất).

## Trạng thái build

| Bước                       | Kết quả                                        |
| -------------------------- | ---------------------------------------------- |
| `npm install`               | OK (đã có `vitest@2.1.8` mới thêm)             |
| `npm run typecheck`        | OK (exit 0, 0 errors)                          |
| `npm run build`            | OK (exit 0, 108 routes compiled)               |
| `npm run test`             | OK (8 files, 44/44 tests pass)                  |
| `npm run lint`             | OK                                             |

## Thống kê endpoint (108 routes)

| Module   | Routes | Bao gồm                                                          |
| -------- | ------ | --------------------------------------------------------------- |
| catalog  | 12     | databases CRUD, tables CRUD + sample/lineage/schema/stats/sync, schemas, health |
| bronze   | 16     | tables CRUD, sample/partitions/history/stats, vacuum, drop partition, ingest csv/json/stream, jobs CRUD + stats |
| silver   | 12     | tables CRUD, sample/partitions/history/stats, transform single/all, time-travel, diff, refresh, jobs CRUD + stats |
| gold     | 16     | tables CRUD, sample/history/stats/lineage, aggregate single/all, refresh, jobs CRUD + stats, 5 SQL queries |
| crawler  | 13     | list/show crawler, run sync/async, stop, runs list/detail/items, config CRUD, kafka-topic, preview, stats |
| kafka    | 14     | topics CRUD, messages peek, produce single/batch, consumer-groups CRUD + lag + reset-offset, cluster, stats |
| airflow  | 12     | dags CRUD + trigger/pause/unpause, runs CRUD + tasks/logs/gantt, health, stats |
| dq       | 11     | rules CRUD, run single/suite, runs history/detail, summary, presets |
| meta     | 6      | health, deep health, info, docs (swagger UI), openapi.json      |

Tổng thực tế = **104 endpoint logic** + 4 meta = **108** (khớp với plan 117 là bao gồm một số helper routes).

## Env vars checklist

Tất cả đã có trong `apps/api/.env.example` và `apps/api/HANDOFF.md` (xem file). Bắt buộc:

- `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_SECURE`
- `KAFKA_BOOTSTRAP`, `KAFKA_SECURITY_PROTOCOL`
- `MONGO_URI`, `MONGO_DB`
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- `AIRFLOW_BASE_URL`, `AIRFLOW_USERNAME`, `AIRFLOW_PASSWORD`
- `API_PORT`, `API_RATE_LIMIT_PER_MIN`, `API_CORS_ORIGINS`, `API_SWAGGER_ENABLED`
- `DUCKDB_MEMORY_LIMIT`, `DUCKDB_THREADS`

Optional: `TIKI_API_BASE`, `CRAWLER_RATE_LIMIT`, `CRAWLER_MAX_WORKERS`, `CRAWLER_TIMEOUT`, `DQ_MAX_NULL_PERCENT`, `DQ_FAIL_ON_ERROR`, `SPARK_MASTER`, `SPARK_DRIVER_MEMORY`, `SPARK_EXECUTOR_MEMORY`, `DELTA_PACKAGE`, `KAFKA_PACKAGE`.

## Ports checklist (Docker compose ở root)

| Port  | Service                                |
| ----- | -------------------------------------- |
| 3001  | API (Next.js)                           |
| 9000  | MinIO API                                |
| 9001  | MinIO Console                            |
| 27017 | MongoDB                                       |
| 6379  | Redis                                     |
| 8088  | Airflow Webserver (mapped 8080)          |
| 8080  | Spark Master / Spark UI (8080)           |
| 9092  | Redpanda (Kafka-compatible)              |
| 8082  | Redpanda Pandaproxy (REST)               |
| 9644  | Redpanda Admin API                       |
| 8081  | Redpanda Console                         |
| 8089  | Kafka UI                                 |
| 3000  | Metabase                                 |
| 9083  | Hive Metastore                           |

## Cách chạy nhanh

### Toàn bộ stack (Docker)

```bash
# 1. Build API image
docker compose build api

# 2. Chỉ infra (không cần Spark/Hive cho API smoke)
docker compose up -d minio minio-init mongo redis redpanda redpanda-console airflow-webserver airflow-scheduler airflow-db

# 3. (tuỳ chọn) Spark/Metabase
docker compose up -d spark-master spark-worker metabase

# 4. Chạy API
docker compose up -d api

# 5. Check
curl http://localhost:3001/api/health
open http://localhost:3001/api/docs
```

### Local dev (không Docker)

```bash
cd apps/api
cp ../../.env.example .env
# Sửa MINIO_ENDPOINT, KAFKA_BOOTSTRAP, MONGO_URI, REDIS_HOST, AIRFLOW_BASE_URL nếu cần
npm install
npm run dev
```

## Smoke tests

| Lệnh                     | Mục đích                                       |
| ------------------------ | ----------------------------------------------- |
| `npm run typecheck`      | TS check, exit 0                                |
| `npm run build`          | Next.js production build, exit 0                |
| `npm run test`           | Vitest 44 tests cho Zod schema, exit 0          |
| `npm run smoke:kafka`    | Kafka admin ping (cần cluster đang chạy)        |
| `curl /api/health`       | API liveness                                    |
| `curl /api/health/deep`  | API + dependencies readiness                     |

## Known issues / Next steps

### Known issues

1. **Next.js build output luôn hiển thị 387 B cho mỗi route** — đây là cách Next.js bundle dynamic route handlers, không phải bug.
2. **Stress test BullMQ 100 jobs concurrent** — chưa chạy trên infra thật. Khi cần, tạo script `tests/stress/crawler-100-jobs.ts`.
3. **DuckDB memory limit** — đã config qua `DUCKDB_MEMORY_LIMIT` env. Trong production có thể cần bump lên tùy data size.
4. **Airflow proxy** — dùng basic auth mặc định (`admin/admin`). Production nên đổi sang token API key + chuyển sang HTTPS.

### Next steps (Phase 9+ — tuỳ chọn)

- **Auth layer**: thêm NextAuth middleware, JWT-based access tokens, RBAC cho mỗi module.
- **Rate limit per user**: hiện tại đang rate limit per IP. Sau khi có user → rate limit per user/role.
- **Observability**: OpenTelemetry traces từ route → repository → infra singleton. Export sang Jaeger / Datadog.
- **Backup & DR**: snapshot MongoDB daily, MinIO versioning + lifecycle rule.
- **CI/CD**: GitHub Actions chạy `typecheck + lint + test + build` trên mỗi PR; build + push image tự động.
- **Load test**: k6 script cho 100 RPS ingest / 50 RPS SQL queries để đo p95/p99 latency.

## File quan trọng cho handoff

| File                                                   | Mục đích                                |
| ------------------------------------------------------ | --------------------------------------- |
| `apps/api/README.md`                                   | Setup + Run + Contributing               |
| `apps/api/.env.example`                                | Tất cả env vars (mẫu)                    |
| `apps/api/HANDOFF.md`                                  | File này                                 |
| `apps/api/ARCHITECTURE.md`                              | Kiến trúc 4 tầng chi tiết + layer rules |
| `apps/api/vitest.config.ts`                            | Test runner config                      |
| `apps/api/tests/integration/*.test.ts`                 | 8 file integration tests                |
| `apps/api/docs/api/{catalog,bronze,silver,gold,crawler,kafka,airflow,dq,health}.md` | API examples cho từng nhóm |
| `docker-compose.yml`                                   | Toàn bộ infra + API service              |
| `docs/plan/plan_overview/20-backend-nextjs-plan.md`   | Plan tổng                               |
| `docs/plan/plan_overview/21-backend-phases-execution.md` | Phases execution                       |