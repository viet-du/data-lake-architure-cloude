# Implementation Plan — Phase 1: Foundation (Backend Next.js)

> **Ngày:** 2026-10-06
> **Phase:** P1 (Tuần 1 trong 8 tuần)
> **Tasks:** 5 (T1 → T5)
> **Mục tiêu cuối P1:** Có BE skeleton chạy được, Swagger UI hoạt động tại `/api-doc`, health check trả 200

---

## 1. Task Objective

Scaffold và foundation cho Backend API theo kiến trúc Next.js 15 + TypeScript 5.x với 4 lớp Route → Controller → Service → Repository. Phase 1 chỉ tạo skeleton + 5 singletons infrastructure + Swagger UI + 4 health/info endpoints, **chưa implement business logic** (để các Phase 2-7).

**Theo working_rule.md:**
- Chương 11 (Architecture & Coding Style): Follow codebase hiện tại (project có sẵn Next.js monorepo structure trong plan 20)
- Chương 13 (Naming Convention): Component/Screen file `kebab-case` + suffix; Service/Helper file `kebab-case`; Component name `PascalCase`; Enum `EPascalCase` với value UPPERCASE
- Chương 28.1: KHÔNG thêm comment (kể cả JSDoc) trừ khi giải thích logic phức tạp
- Chương 28.2: KHÔNG thêm icon ngoài design system
- Chương 28.3: Tuân thủ kiến trúc đã chốt trong plan 20

**Quyết định đã chốt với sếp:**
- Root: `apps/api/` (monorepo tách biệt)
- Docker: chỉ tạo Dockerfile + compose service entry, chưa chạy thật Mongo/Redis
- Verify: chạy build + dev server + curl từng endpoint

---

## 2. Files Impacted (sẽ được tạo mới — không touch file hiện có)

### 2.1. P1-T1 — Scaffold project & dependencies

| File | Mục đích |
|------|----------|
| `apps/api/package.json` | Deps + scripts |
| `apps/api/tsconfig.json` | TypeScript strict config + paths |
| `apps/api/.eslintrc.json` | ESLint config |
| `apps/api/.prettierrc` | Prettier config |
| `apps/api/.gitignore` | Gitignore riêng cho apps/api |
| `apps/api/next.config.ts` | Next.js config (serverExternalPackages) |
| `apps/api/next-env.d.ts` | Next.js types |

### 2.2. P1-T2 — Env validation & base config

| File | Mục đích |
|------|----------|
| `apps/api/src/config/env.ts` | Zod schema cho env vars |
| `apps/api/src/config/constants.ts` | App constants (MAX_PAGE_SIZE, etc.) |

### 2.3. P1-T3 — Infrastructure singletons (5 files riêng, mỗi file 1 trách nhiệm)

| File | Trách nhiệm duy nhất |
|------|----------------------|
| `apps/api/src/lib/infra/duckdb/client.ts` | DuckDB instance + Delta/httpfs/MinIO secret |
| `apps/api/src/lib/infra/mongo/client.ts` | Mongoose connection với global cache |
| `apps/api/src/lib/infra/redis/client.ts` | ioredis singleton |
| `apps/api/src/lib/infra/s3/client.ts` | AWS SDK S3 client (MinIO) |
| `apps/api/src/lib/logger/pino.ts` | Pino logger |

### 2.4. P1-T4 — Base middlewares & errors (mỗi file 1 trách nhiệm)

| File | Trách nhiệm duy nhất |
|------|----------------------|
| `apps/api/src/middlewares/with-error-handler.ts` | Catch + format errors |
| `apps/api/src/middlewares/with-request-id.ts` | Attach request ID |
| `apps/api/src/middlewares/with-cors.ts` | CORS headers |
| `apps/api/src/middlewares/with-rate-limit.ts` | Redis rate limit |
| `apps/api/src/errors/app-error.ts` | AppError base class |
| `apps/api/src/errors/not-found-error.ts` | NotFoundError extends AppError |
| `apps/api/src/errors/validation-error.ts` | ValidationError extends AppError |
| `apps/api/src/errors/conflict-error.ts` | ConflictError extends AppError |
| `apps/api/src/lib/http/response-builder.ts` | ok/created/noContent helpers |

### 2.5. P1-T5 — Swagger + Health + Docker (route files mỏng, delegate xuống controller)

| File | Trách nhiệm duy nhất |
|------|----------------------|
| `apps/api/src/app/layout.tsx` | Root layout (minimal) |
| `apps/api/src/app/page.tsx` | Landing page (link tới /api-doc, /api/health) |
| `apps/api/src/app/api-doc/page.tsx` | Swagger UI page (server component) |
| `apps/api/src/app/api-doc/swagger-ui-client.tsx` | Swagger UI client component (dynamic import) |
| `apps/api/src/app/api/docs/openapi.json/route.ts` | OpenAPI spec endpoint |
| `apps/api/src/app/api/health/route.ts` | Overall health |
| `apps/api/src/app/api/health/deep/route.ts` | Deep health check |
| `apps/api/src/app/api/info/route.ts` | App info |
| `apps/api/src/app/api/docs/route.ts` | Docs redirect |
| `apps/api/src/modules/health/controllers/health.controller.ts` | Health controller |
| `apps/api/src/modules/health/services/health.service.ts` | Health service (check từng service) |
| `apps/api/Dockerfile` | Docker build |
| `docker-compose.api.yml` | Compose cho API stack (không modify docker-compose.yml gốc) |
| `apps/api/.env.example` | Env example (sẽ copy từ .env + thêm API env) |

---

## 3. Planned Changes (chi tiết từng task)

### P1-T1 — Scaffold & install dependencies

- Tạo `apps/api/package.json` với 19 deps (xem plan 20 §2)
- Scripts: `dev`, `build`, `start`, `lint`, `typecheck`
- TypeScript strict mode: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`
- Paths: `@/*` → `./src/*`
- ESLint: `next/core-web-vitals` + `@typescript-eslint/recommended`
- Prettier: `singleQuote: true`, `semi: true`, `printWidth: 100`
- **Verify:** `pnpm install` không lỗi, `pnpm tsc --noEmit` pass

### P1-T2 — Env validation

- Zod schema validate 50+ env vars (existing + new)
- `env` export = `EnvSchema.parse(process.env)` ở startup
- Throw ngay nếu thiếu required var
- **Verify:** import ở module nào đó, dev server fail với message rõ ràng nếu thiếu

### P1-T3 — Infrastructure singletons

- **DuckDB:** global cache pattern (Promise), install `delta` + `httpfs`, create MinIO secret với KEY_ID/SECRET/ENDPOINT từ env
- **Mongo:** global cache pattern, `bufferCommands: false`, log connection events
- **Redis:** ioredis singleton với `lazyConnect: false`
- **S3:** AWS SDK v3 với `forcePathStyle: true` (MinIO yêu cầu)
- **Pino:** 2 destinations (pretty local + JSON prod), level từ env
- **Verify:** viết 1 route `/api/health` test gọi từng singleton không throw

### P1-T4 — Base middlewares

- `withErrorHandler` HOF: catch `AppError` → custom status, `ZodError` → 400, unknown → 500
- `withRequestId`: read `x-request-id` hoặc generate UUID v4, attach vào response header + context
- `withCors`: read `API_CORS_ORIGINS` env, set headers
- `withRateLimit`: Redis INCR với TTL 60s, return 429 nếu > limit
- Custom errors: extends `AppError`, có `status`, `code`, `message`
- **Verify:** unit test 1 route với mỗi middleware, check header/response đúng

### P1-T5 — Swagger + Health + Docker

- OpenAPI route dùng `createSwaggerSpec({ apiFolder: 'src/app/api', autoDoc: true })`
- Swagger UI client component với `dynamic(..., { ssr: false })`
- 4 routes: `/api/health`, `/api/health/deep`, `/api/info`, `/api/docs` (redirect)
- Dockerfile multi-stage (deps → builder → runner) với Node 20
- `docker-compose.api.yml` thêm 3 services: `api`, `mongo`, `redis`
- **Verify:** `pnpm dev` chạy, `curl localhost:3001/api/health` trả JSON, `curl localhost:3001/api-doc` trả Swagger UI HTML, `curl localhost:3001/api/docs/openapi.json` trả OpenAPI spec

---

## 4. Reason (tại sao cần làm)

Theo working_rule chương 1 (Core Principle: Plan Before Implementation), mọi code change phải có plan rõ ràng trước khi sửa file. Phase 1 là foundation để 7 phases sau (P2-P8) build trên. Nếu foundation sai (singleton không cache, env không validate, middleware không composable) → tất cả 117 endpoints bị ảnh hưởng.

---

## 5. Impact (tác động)

- **Tạo mới ~35 files** trong `apps/api/` — không touch file hiện có nào (chỉ thêm `docker-compose.api.yml` ở root, không sửa `docker-compose.yml` đang chạy)
- Thêm 1 entry trong `.gitignore` root: `apps/api/node_modules/`, `apps/api/.next/`
- Không ảnh hưởng existing pipeline (`src/lakehouse/`, `airflow_dags/`, `sql/`)
- Disk: ~200MB cho `node_modules/`

---

## 6. Risk

| # | Rủi ro | Mức | Mitigation |
|---|--------|-----|-----------|
| R1 | DuckDB native binding không cài được trên macOS M1 | Cao | Dùng `@duckdb/node-api` version prebuilt, fallback `duckdb-async` nếu fail |
| R2 | `pnpm install` timeout do network | Trung bình | Retry với `--prefer-offline`, dùng npm mirror |
| R3 | `serverExternalPackages` config sai → DuckDB crash khi bundle | Cao | Test `pnpm build` + `pnpm start` (không chỉ `pnpm dev`) |
| R4 | TypeScript strict + Next.js 15 App Router có breaking change | Thấp | Pin version cụ thể, đọc Next.js 15 release notes |
| R5 | Hot-reload làm leak Mongo connection | Trung bình | Global cache pattern đã có trong plan |

---

## 7. Alternatives (nếu approach này fail)

| Approach chính | Alternative |
|----------------|-------------|
| Monorepo với `apps/api/` | Single root `next.config.ts` ở root (đơn giản hơn, ít isolate) |
| `next-swagger-doc` | `next-openapi-gen` (Zod-first) hoặc tự viết OpenAPI bằng tay |
| `@duckdb/node-api` | `duckdb` (legacy) + `duckdb-async` wrapper |
| Mongoose | Native MongoDB driver (nhẹ hơn, ít feature) |

---

## 8. Validation Plan (cách verify từng bước)

Sau MỖI task, em sẽ chạy:

| Task | Verify command | Expected |
|------|---------------|----------|
| P1-T1 | `pnpm install && pnpm tsc --noEmit` | Exit 0, no error |
| P1-T2 | `pnpm dev` (sẽ fail nếu env thiếu) | Fail với message rõ ràng về var thiếu |
| P1-T3 | `curl http://localhost:3001/api/health` (sau khi có route) | Trả `200` với JSON chứa duckdb/mongo/redis/s3 status |
| P1-T4 | `curl -H "X-Request-Id: test-123" localhost:3001/api/health` | Response có header `x-request-id: test-123` |
| P1-T5 | `curl localhost:3001/api/doc/openapi.json` | Trả OpenAPI spec JSON hợp lệ |
| | `curl localhost:3001/api-doc` | Trả HTML Swagger UI |
| | `docker build -t lake-api apps/api/` | Build thành công |

Nếu bất kỳ verify nào FAIL → em lên plan fix ngay (theo chương 29 Self-Retrospective nếu fail 3 lần cùng hướng).

---

## 9. Wait Human Confirm

> **Trước khi em bắt đầu code, em cần sếp xác nhận 4 điểm:**

1. Số lượng file 35 trên đã hợp lý chưa, hay muốn em gộp/tách lại?
2. Em có nên dùng `pnpm` hay `npm` (project hiện không có `pnpm-lock.yaml`)?
3. Node version em assume là 20.x — có đúng với môi trường sếp không?
4. Sếp muốn em chạy `pnpm install` thật ngay (cần network + ~200MB) hay em chỉ tạo file skeleton để sếp tự chạy?

---

**Ký:** Main Agent (Cursor IDE AI) — 2026-10-06 — chờ sếp duyệt
