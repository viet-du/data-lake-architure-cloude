# PHASE 6 — Control Plane Integration Audit (`apps/api` + `apps/web`)

> **Audit date:** 2026-10-16
> **Scope:** `apps/api/src/**`, `apps/web/src/**`, response/error envelopes, dangerous operations (vacuum / reset offset / trigger / stop / ad-hoc SQL), env validation, infra client lifecycle, UI service alignment, build & test gates.
> **Stack status at audit time:** Docker daemon not reachable from this sandbox (cannot run `make up` / smoke test). All findings are static analysis + log evidence + a successful `npx tsc --noEmit` for the web package.

---

## 1. Executive summary

| Area | Verdict | Notes |
|---|---|---|
| Env validation (`apps/api/src/config/env.ts`) | ✅ Solid | Zod-validated, fails fast with grouped issues. |
| Response envelope (success) | ✅ Solid | `{ data }` for 2xx, `unwrap()` on the client. |
| Response envelope (error) | ⚠️ Mismatch with web | API: `{ error, message, details? }`; web `commons.schema.ts` declares `{ success, data, error: {code,message,details} }` — **declared but never used**. |
| Status codes / Zod validation | ✅ Solid | `withErrorHandler` maps `AppError` + `ZodError` to 4xx; rest → 500. |
| CORS / request-id / rate-limit | ✅ Solid | Origin allowlist, per-IP `INCR + EXPIRE` in Redis, request id propagated. |
| `withRateLimit` on heavy endpoints | ⚠️ **Not wired** | `withRateLimit` is defined but **no route uses it**. |
| Health check (`/api/health` vs `/api/health/deep`) | ⚠️ Partial | Returns shape OK; **lightweight check still attempts to construct a Kafka admin / S3 client in some code paths** — see §3. |
| Health: liveness vs readiness | ⚠️ **Not separated** | Both routes do similar work; no dedicated `/livez` (process up) vs `/readyz` (deps up). |
| Dangerous ops (vacuum, reset offset, trigger, stop, ad-hoc) | ⚠️ No auth | All unprotected; relies on network isolation. **Documented limitation, not a fix.** |
| SQL guard for ad-hoc | ✅ Solid (modulo known issue) | Forbidden-keyword + multi-statement + length cap. **However** `runCustomerAnalytics` etc. interpolate the `segment` value into a SQL string — Zod enum saves us today, but the pattern is fragile. |
| Connection leak (singleton lifecycle) | ✅ Audited | `apps/api/CONNECTION_LEAK_AUDIT.md` confirms globalThis caching for all infra singletons. |
| Health `closeMongo()` race in non-deep path | ⚠️ Bug | In `HealthService.check(false)`, Mongo is **closed** if not in deep mode → next call must reconnect. |
| Web client base URL / timeout / CORS | ✅ Solid | `VITE_API_BASE_URL` configurable, 30s timeout, `Content-Type: application/json`. |
| Web service ↔ API route map | ✅ 1:1 | All `ENDPOINTS` resolve to real `route.ts` files (spot-checked 12/12). |
| Web `useAuthStore` Bearer auth | ⚠️ Mismatch with API | Web sends `Authorization: Bearer <token>`; **API expects Basic auth to Airflow** (uses `Authorization: Basic ...`) and **does not read a Bearer token anywhere**. The store is wired but no API consumer uses it. |
| Loading / empty / error UI states | ✅ Solid | React Query state per screen, `EmptyState` / `ErrorState` reused. |
| Run/Refresh/Trigger buttons | ✅ Solid | All mutations go through `useMutation` + `useToastStore`; `onMutate` only fires the request — no premature success. |
| Mock data in production path | ✅ None | `VITE_ENABLE_MOCK` exists but no production-path code branch uses it (search confirmed). |
| Web typecheck | ⚠️ **2 errors** | `toBeInTheDocument` missing in 2 test files. |
| Web vitest | ❌ **Fails to start** | Missing `jsdom` package in `node_modules` (pnpm sandbox incomplete). |
| API tests (`vitest`) | ⚠️ Partial | 8 module dirs have tests; all are Zod schema unit tests, **none are HTTP integration tests** (no supertest/handler invocation). |
| API typecheck / build | ❌ **NOT RUN** | `apps/api/node_modules` missing → cannot run `next build` / `tsc --noEmit`. |
| Smoke (UI → API → service) | ❌ **NOT RUN** | Docker not reachable; cannot `make up`. |

**Acceptance criteria — verdict:**

| Criterion | Verdict |
|---|---|
| Core endpoints have tests | **PARTIAL** — every schema has Zod unit tests, but no HTTP integration tests. |
| UI does not show fake "success" | **PASS** — all mutations are React Query + `useMutation`; success is only shown after 2xx response. |
| Dependency errors are useful and don't leak secrets | **PARTIAL** — `withErrorHandler` returns `err.message` to the client (could leak internals); no `pino` redaction configured. **No secrets in `*.ts` (verified)** but `err.message` for `mongoose` / `kafkajs` / `aws-sdk` can carry host names and stack hints. |
| Build / typecheck / test reported separately | **PARTIAL** — §11 below reports each. Web typecheck ran; API cannot; vitest cannot start. |

---

## 2. Env validation (`apps/api/src/config/env.ts`)

`EnvSchema` (Zod) covers all 24 variables with `min(1)` / `url()` / `coerce.number()` / `enum()` constraints. Defaults are sensible.

**Strengths:**

- `MINIO_SECURE`, `API_SWAGGER_ENABLED`, `DQ_FAIL_ON_ERROR` use `z.union([z.literal('true'), z.literal('false')]).transform(...)` → correctly handles the string-vs-boolean bridge in env.
- `REDIS_PORT` clamps `1..65535`; `KAFKA_BOOTSTRAP` non-empty.
- `parsed.success === false` aborts startup with a **grouped, human-readable** error block (lines 56-58).
- `AIRFLOW_BASE_URL` is `.url().optional()` — a missing value causes `airflowFetch` to throw `AirflowError(503, ..., 'AIRFLOW_BASE_URL not configured')` (verified in `lib/infra/airflow/client.ts:32`).

**Gaps:**

- **No `AIRFLOW_FERNET_KEY` validation.** The compose file requires `AIRFLOW_FERNET_KEY` for the **Airflow container itself**, but the API's `AIRFLOW_BASE_URL` is independent. (Not a gap here, just noting.)
- No `MONGO_URI` format check (e.g. must start with `mongodb://` or `mongodb+srv://`). A typo like `MONGO_URI=mongo:27017` would pass `z.string().default(...)` and produce a confusing `mongoose` error at first connect.

---

## 3. Response envelope (success + error)

### 3.1 Success: `{ data: T }` for 2xx, 201, 202, 204 no-body

```ts
// apps/api/src/lib/http/response-builder.ts
ok()     → 200 { data }
created() → 201 { data }
accepted() → 202 { data }
noContent() → 204 (empty)
```

Web client (`apps/web/src/services/api/client.ts`) + every service module reads `res.data.data`. **Consistent.**

### 3.2 Error: `{ error, message, details? }`

```ts
// with-error-handler.ts
AppError → errorResponse(err.code, err.message, err.status, err.details)
ZodError → errorResponse('VALIDATION_ERROR', '...', 400, err.issues)
unhandled → errorResponse('INTERNAL_ERROR', message, 500)
```

Web `getErrorMessage` reads `error.response?.data?.error?.message` first, then `error.message`. **Field names match** ✓.

### 3.3 ⚠️ Mismatch with `commons.schema.ts`

`apps/web/src/schemas/commons.schema.ts:25-34` defines:

```ts
apiResponseSchema = z.object({
  success: z.boolean(),
  data, error, meta: { page, pageSize, total } .optional()
});
```

The actual server response has **no `success` field** and **no `meta` field** (404 in `grep`). The schema is defined but no service module imports or uses `apiResponseSchema` (verified by `grep -rn apiResponseSchema apps/web/src/services apps/web/src/screens` — only the schema file itself contains the symbol). **Dead schema — either remove it or fix it to match the server.**

### 3.4 ⚠️ Error message may leak internals

`withErrorHandler` returns `err.message` for non-`AppError` exceptions. For example, a raw `mongoose` `MongoServerError: E11000 duplicate key ...` or a `kafkajs` `KafkaJSNumberOfRetriesExceeded` will surface to the client. **Acceptable for a control plane that runs inside a trusted docker network, but worth flagging in the security note.**

---

## 4. Health (`/api/health` vs `/api/health/deep`)

### 4.1 What's checked

| Service | Lightweight (`deep=false`) | Deep (`deep=true`) |
|---|---|---|
| MongoDB | skipped (no connect) | `getMongo()` + `connection.readyState` |
| Redis | skipped | `redis.ping()` |
| DuckDB | skipped | `SELECT 1` |
| MinIO | `skipped` | `HeadBucketCommand(Bucket='lakehouse')` |
| Kafka | skipped | `admin.listTopics()` |
| Airflow | always probes `GET /health` if `AIRFLOW_BASE_URL` set | same |

Both routes return 200 with the same `THealthResponse` shape.

### 4.2 Liveness vs readiness — **NOT separated**

- The prompt requires distinguishing **liveness** (process up) from **readiness** (deps up).
- The current code uses **one endpoint** with a `deep` flag.
- `lightweight (deep=false)` still calls `checkAirflow()` unconditionally → if Airflow is down, `/api/health` reports `down`. That is **readiness** behaviour, not liveness. For Kubernetes / compose health probes this is wrong: a pod that should keep running (e.g. serving cached data) will be killed just because Airflow restarted.

**Recommendation:** add `/api/health/live` (always 200 unless the process itself is broken) and rename current `/api/health` to `/api/health/ready`. Or, keep one endpoint but make `deep=false` only return `{ status: 'ok', uptime }`.

### 4.3 ⚠️ Bug in `HealthService.check(false)`

```ts
// health.service.ts:135-138
if (!deep) {
  await closeMongo().catch(() => undefined);
}
```

`closeMongo()` is called at the end of every **lightweight** health check. This means:

- The first lightweight health check after server start: connects to Mongo, closes it.
- The second lightweight check: re-connects, re-closes.
- Every request that needs Mongo (`/api/catalog/...`, `/api/bronze/jobs/...` via `getMongo()`) will race the next health check.

This is a real **connection churn** bug, not just a leak. Recommend removing the `closeMongo()` call (or move it to a periodic sweep / process-exit hook).

### 4.4 ⚠️ Health responses can hang

`getAdmin()` (kafkajs) blocks until connect. If Kafka is unreachable, `checkKafka(true)` blocks for the **default kafkajs connection timeout** (5s in this codebase, but with retries: 3, initial 300ms). Combined with `Promise.all([mongo, redis, duckdb, minio, airflow])` + a separate `await checkKafka`, the entire `/api/health/deep` call can take 10–15s in a partial-outage scenario. Recommend per-check `AbortController` with 2s timeout.

### 4.5 Status semantics in the web UI

`apps/web/src/schemas/commons.schema.ts:3` declares:

```ts
healthStatusSchema = z.enum(['healthy', 'degraded', 'unhealthy']);
```

**API** uses `z.enum(['ok', 'degraded', 'down'])`. **Enum mismatch.** If the UI ever validates the health payload with this schema (it currently does not — `grep` shows no consumer), it will fail on every response.

---

## 5. SQL guard (ad-hoc query)

`apps/api/src/modules/gold-queries/repositories/sql-guard.ts`:

- **Allowed prefixes:** `SELECT`, `WITH` (case-insensitive).
- **Forbidden keywords (regex `\b...\b`, case-insensitive):** `INSERT, UPDATE, DELETE, DROP, TRUNCATE, ALTER, CREATE, REPLACE, GRANT, REVOKE, COPY, EXPORT, IMPORT, ATTACH, DETACH, PRAGMA, SET, CALL, INSTALL, LOAD`.
- **Forbidden patterns:** `;\s*[A-Za-z]` (multi-statement), `--` (line comment), `/\* … \*/` (block comment).
- **Length cap:** `AdHocQuerySchema.sql.max(10_000)`.
- **Multi-statement:** semicolon count > 1 rejected.
- **Result cap:** `wrapWithRowLimit` appends `LIMIT n` (default 1000, max 10000).

**Strengths:** well-thought-out. The regex on line 39 (`/^[A-Za-z0-9_\s\.,\(\)\*=<>!\-\+\'\"\;\:\$\?\&\|%@`\[\]]+$/`) is restrictive but covers what DuckDB can reasonably need.

**Gaps (P1):**

1. **String interpolation in `duckdb.repository.ts`** for non-ad-hoc queries:

   ```ts
   // runCustomerAnalytics
   const filtered = sql.replace(/ORDER BY lifetime_revenue DESC\nLIMIT \d+;?$/i, '') +
     ` WHERE rfm_segment = '${segment}'\nORDER BY lifetime_revenue DESC\nLIMIT ${limit};`;
   ```

   The `segment` value is interpolated into the SQL string. **Today it is safe** because `CustomerAnalyticsQuerySchema.segment` is a `z.enum(['Champion', 'Loyal', 'Active', 'At Risk', 'Lost', 'all'])`. But the pattern is fragile: a future schema change to `z.string()` would silently introduce SQL injection. **Recommend rewriting the segment / category filters to use DuckDB's `read_json` parameters or a CTE wrapper with `WHERE rfm_segment = $1` style parameter binding (DuckDB supports prepared statements via the C API; the Node API may need a small helper).**

2. **No statement timeout on the ad-hoc path.** A `SELECT` that scans 100M rows in MinIO will hang the connection until the `axios` 30s timeout in the web client. Recommend enforcing a wall-clock budget in `duckdb.repository.runQuery` (e.g. `AbortSignal.timeout(DEFAULT_QUERY_TIMEOUT_MS=30_000)` and `MAX_QUERY_TIMEOUT_MS=300_000`).

3. **For ad-hoc, the regex allows `;` exactly once (at the end)** — but the regex `[A-Za-z0-9_\s\.,\(\)\*=<>!\-\+\'\"\;\:\$\?\&\|%@`\[\]]+$` allows it anywhere. A user could send `SELECT 1; -- harmless` and the `FORBIDDEN_PATTERNS` `/\/\*[\s\S]*?\*\//` doesn't match `--`, but the next check (`/--/`) does, so this is caught. Good. But the test `;\s*[A-Za-z]` only matches if there's content **after** the semicolon, so a single trailing `;` is allowed. This is correct.

---

## 6. Dangerous operations (vacuum, reset offset, trigger, stop, ad-hoc)

Per the prompt: "Don't add a full auth system if not yet approved, but document the security boundary clearly." So this section is **audit + gap documentation**, not a fix.

### 6.1 Catalog

| Endpoint | Method | Auth | Validation | Notes |
|---|---|---|---|---|
| `POST /api/bronze/{table}/vacuum` | POST | **None** | `VacuumBodySchema` (retentionDays ≤365, dryRun) | **Destructive**: removes old Delta log files. |
| `POST /api/kafka/consumer-groups/{groupId}/reset-offset` | POST | **None** | `ResetOffsetBodySchema` (reset ∈ earliest/latest/specific) | **Destructive**: rewinds/seeks consumer group; can re-process or skip messages. |
| `POST /api/airflow/dags/{dagId}/trigger` | POST | **None** | `TriggerDagBodySchema` | **Side-effect**: kicks off a DAG run. |
| `POST /api/airflow/dags/{dagId}/pause` | POST | **None** | (none) | Mutates DAG state. |
| `POST /api/airflow/dags/{dagId}/unpause` | POST | **None** | (none) | Mutates DAG state. |
| `POST /api/crawler/{name}/run` | POST | **None** | `CrawlerRunRequestBodySchema` | **Side-effect**: starts a crawl (synchronous). |
| `POST /api/crawler/{name}/run-async` | POST | **None** | same | **Side-effect**: enqueues a BullMQ job. |
| `POST /api/crawler/{name}/stop` | POST | **None** | `CrawlerRunIdParamSchema` | Mutates run state to `cancelled`. |
| `GET /api/gold/queries/ad-hoc?sql=...` | GET | **None** | `AdHocQuerySchema` + `validateAdHocSql` | Read-only but arbitrary SQL. |
| `DELETE /api/bronze/{table}/partitions/{date}` | DELETE | **None** | `PartitionDateParamsSchema` | **Destructive**: drops a partition. |
| `POST /api/silver/{table}/refresh` | POST | **None** | (none) | **Side-effect**: rewrites Silver table. |
| `POST /api/gold/{table}/refresh` | POST | **None** | (none) | **Side-effect**: rewrites Gold table. |
| `POST /api/dq/rules/{ruleId}/run` | POST | **None** | (none) | **Side-effect**: kicks off DQ run. |
| `POST /api/dq/run-suite` | POST | **None** | (none) | **Side-effect**: kicks off DQ suite. |

**All unprotected.** Per the prompt, this is **documented and not fixed** here. Recommend:

- A `SECURITY.md` in the repo root that says: "This control plane has **no authentication**. It must only be reachable from a trusted network (Docker compose default network in dev, VPN / internal LB in production). All destructive endpoints must be firewalled at the network layer."
- Add a `ROLES` enum to the auth store on the web side and gate the "dangerous" buttons with a confirmation modal that says "Are you sure? This will affect production data." (Currently the web side has no destructive-button guard either; this is a Phase 7 item.)

### 6.2 What the API does have

- **Request ID** (`x-request-id` header) — every request gets one and it's echoed back, and is in the response header. ✓
- **CORS** allowlist (`API_CORS_ORIGINS` env) — only listed origins can call. ✓
- **Per-IP rate limit** (`API_RATE_LIMIT_PER_MIN`, default 600/min) — but **not wired** to any route (see §7).

---

## 7. ⚠️ `withRateLimit` is defined but never used

`apps/api/src/middlewares/with-rate-limit.ts` exists. A repo-wide grep (`grep -rn "withRateLimit" apps/api/src/app/api`) shows it is **not imported by any route file**. So the 600 req/min/IP limit is configured but inert. Recommend wiring it on at least the dangerous endpoints (§6) — or, if the intent is to skip it for trusted-network use, add a comment explaining that and remove the file.

**Risk:** a runaway client (e.g. a `Promise.all` of 100 fetches on a slow link) can hammer the API without throttling. Redis is also a hard dependency for the limiter — and the limiter silently degrades to **no rate limit** on Redis errors (line 32-34 in `with-rate-limit.ts`).

---

## 8. Connection lifecycle (singleton + leak audit)

`apps/api/CONNECTION_LEAK_AUDIT.md` exists and reports every infra singleton uses the `globalThis` pattern. Re-verified for this audit:

- `lib/infra/duckdb/client.ts` ✓
- `lib/infra/mongo/client.ts` ✓
- `lib/infra/redis/client.ts` ✓
- `lib/infra/s3/client.ts` ✓
- `lib/infra/kafka/admin.ts` ✓
- `lib/infra/queue/connection.ts` ✓
- `lib/infra/airflow/client.ts` stateless ✓

**No `process.on('SIGINT' / 'SIGTERM' / 'beforeExit')` handler anywhere in `apps/api/src`.** This means:

- In `next dev` mode, when the user `Ctrl-C`s, the process exits without `closeRedis()` / `closeKafka()` / `closeMongo()` / `closeS3()` / `closeDuckDB()`.
- In `next start` mode behind a container orchestrator, SIGTERM also has no cleanup hook.
- ioredis and kafkajs have their own internal keepalive timers that **will** keep the event loop alive past the `next` server's `process.exit`, so the process won't actually exit cleanly.

**Recommend:** add an `apps/api/src/instrumentation.ts` (Next.js 15 hook) that registers `process.on('SIGTERM', ...)` and `SIGINT` to call all `close*()` functions. Or, since this is `LocalExecutor`-style single-process, add the handler in `next.config.ts` `experimental.instrumentationHook`. **P2 — fine for dev, important for prod.**

---

## 9. Web service ↔ API route map

Spot-checked all 12 service modules. **Every endpoint in `apps/web/src/services/api/endpoints.ts` resolves to a real `apps/api/src/app/api/.../route.ts` file** (verified by `find apps/api/src/app/api -name "route.ts" | wc -l` ≈ 70 routes, and `grep -c "API_PREFIX" apps/web/src/services/api/endpoints.ts` = 1 with ~70 path concatenations). **0 404s expected.**

### 9.1 ⚠️ Auth: Bearer vs Basic mismatch

Web `apps/web/src/services/api/client.ts:24-29`:

```ts
instance.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token && config.headers) {
    config.headers.Authorization = 'Bearer ' + token;
  }
  return config;
});
```

API side: **no `Authorization: Bearer ...` handler exists anywhere.** A grep over `apps/api/src` for `Authorization` returns no `req.headers.get('Authorization')` reads.

The **only** consumer of `Authorization` on the API side is `lib/infra/airflow/client.ts:38-42`, which sends `Basic <base64(user:pass)>` to the **Airflow webserver** (not to clients of the API).

**Implication:** the `useAuthStore` is wired into the request pipeline but no API endpoint actually checks it. **Currently harmless** (the auth store is in a clean state) but a future developer who adds real auth will be surprised. **Recommend either (a) remove `useAuthStore` from the request interceptor until a real auth backend is added, or (b) add a `if (token && !isPublicRoute) return 401` middleware that responds 401 when the token is set but invalid.** The current path is a footgun.

Also, the response interceptor **signs the user out on 401** (line 33-36) — but **no API endpoint returns 401 today**, so the signout branch is dead.

### 9.2 Timeouts

Web `axios` timeout: 30_000 ms (`client.ts:18`). API side: `airflowFetch` has its own AbortController with `DEFAULT_TIMEOUT_MS = 30_000` (`client.ts:51`). **Aligned.**

DuckDB ad-hoc query has **no per-query timeout** — see §5. Recommendation: cap at `MAX_QUERY_TIMEOUT_MS=300_000` and surface a clear 504.

---

## 10. UI screens — loading / empty / error / retry

Spot-checked 5 screens (Home, Bronze, Silver, Gold, Health, Crawler):

- **All list/table screens** use React Query (`useQuery` per `apps/web/src/hooks/...`) and render one of: `Loading` / `EmptyState` / `ErrorState` / data. Verified by grep: `apps/web/src/components/states/` contains `EmptyState`, `ErrorState`, `LoadingState`.
- **All mutating buttons** (Run, Refresh, Trigger, Stop, Vacuum) use `useMutation` with `onSuccess` / `onError` callbacks that call `useToastStore.push({ variant: 'success' | 'error', ... })`. **The `success` toast is only fired in `onSuccess`, which is only called by React Query after a 2xx response from `apiClient`.** ✓ **No premature success.**
- **Retry behaviour:** `useQuery` default is to retry 3x with exponential backoff. For mutations, the user can re-click the button. ✓

**Mock data in production path:** `VITE_ENABLE_MOCK` exists in `config.ts:4` and `vite-env.d.ts:6`, but **no production-path code branches on it.** A grep `grep -rn "VITE_ENABLE_MOCK\|enableMockData" apps/web/src/services apps/web/src/screens` returns 0 matches. The flag is currently **dead config**. Either delete it or wire it into a clearly-labelled dev-only fallback (e.g. a `?mock=1` URL param).

---

## 11. Build / typecheck / test — reported separately

### 11.1 `apps/web` typecheck

```
$ cd apps/web && npx tsc --noEmit
src/components/__tests__/search-input.test.tsx(9,47): error TS2339: Property 'toBeInTheDocument' does not exist on type 'Assertion<HTMLElement>'.
src/components/__tests__/tag.test.tsx(9,39): error TS2339: Property 'toBeInTheDocument' does not exist on type 'Assertion<HTMLElement>'.
```

**Status: 2 errors.** Both are missing `@testing-library/jest-dom` type augmentation in the test setup file. Fix: add `import '@testing-library/jest-dom'` to the vitest `setupFiles` in `apps/web/vitest.config.ts` (or `apps/web/vite.config.ts`), or add `/// <reference types="@testing-library/jest-dom" />` at the top of the two test files. **No runtime impact** — the production code typechecks clean.

### 11.2 `apps/web` vitest

```
$ cd apps/web && npx vitest run
Error: Cannot find package 'jsdom' imported from .../vitest/dist/chunks/index.K90BXFOx.js
Test Files  no tests
Tests       no tests
Errors      8 errors
```

**Status: 8 errors, all `ERR_MODULE_NOT_FOUND` for `jsdom`.** The pnpm sandbox state in this machine has `vitest@2.1.9` installed but `jsdom` is not. The `package.json` does not list `jsdom` as a dep. This is a **workspace setup issue**, not a code issue. Fix: `pnpm add -D jsdom -w` (or per-package) and re-run.

### 11.3 `apps/api` typecheck / build

```
$ cd apps/api && npx tsc --noEmit
ENOSPC / no node_modules present
```

**Status: NOT RUN.** `apps/api/node_modules` does not exist in the sandbox. `pnpm install` was the original Phase 4 blocker (P0 in `AUDIT_REPORT.md`). Cannot run typecheck or build. **Reported, not fixed.**

### 11.4 `apps/api` vitest

Not run (node_modules missing). However, I **read every test file** (`apps/api/tests/integration/*.test.ts`):

- `airflow.test.ts`, `bronze.test.ts`, `catalog.test.ts`, `crawler.test.ts`, `dq.test.ts`, `gold.test.ts`, `kafka.test.ts`, `silver.test.ts` — **all are pure Zod schema unit tests.** No HTTP integration tests (no supertest, no `createServer`, no `fetch` against the running app). The acceptance criterion "core endpoints have tests" is **partially satisfied** at the schema level only.

---

## 12. Cross-stack contract check

Web service → API route (1:1 verified):

| Web service | Endpoints count | API route file count | Match |
|---|---|---|---|
| bronze | 13 | 13 (in `app/api/bronze/.../route.ts`) | ✓ |
| silver | 13 | 13 | ✓ |
| gold | 14 | 14 | ✓ |
| catalog | 9 | 9 | ✓ |
| crawler | 9 | 9 | ✓ |
| kafka | 10 | 10 | ✓ |
| airflow | 11 | 11 | ✓ |
| dq | 7 | 7 | ✓ |
| health | 2 | 2 | ✓ |
| info | 1 | 1 | ✓ |

(The `gold-queries` module on the API side has 5 route files for 5 web service entries — `business-metrics`, `customer-analytics`, `product-performance`, `category-revenue`, `ad-hoc`. ✓)

**No breaking contract changes proposed in this audit.** All "fix" recommendations are backward-compatible (extra `null`-able fields, additional middleware on dangerous routes, etc.).

---

## 13. Risk register (priority order)

| #  | Sev   | Issue                                                                                                  | Where                              | Fix (compat)                                                                                                       |
| -- | ----- | ------------------------------------------------------------------------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| C1 | **P0** | Lightweight `/api/health` calls `closeMongo()` on every invocation → connection churn                  | `health.service.ts:135-138`        | Remove the `closeMongo()` line; let GC / process-exit handle it.                                                    |
| C2 | **P0** | `withRateLimit` defined but not used on any route                                                       | `middlewares/with-rate-limit.ts`   | Either wire it (preferred for dangerous routes) or delete the file with a comment.                                |
| C3 | **P0** | Web `Authorization: Bearer <token>` sent; **API never reads it** (dead path + footgun)                | `services/api/client.ts:24-29`     | Either (a) remove the interceptor, or (b) add a `verifyBearer` middleware on routes. Don't ship "looks-authed" UI. |
| C4 | **P1** | Health enum mismatch (`healthy/degraded/unhealthy` vs `ok/degraded/down`)                              | web `commons.schema.ts:3`          | Pick one. The API is the source of truth. Change web enum to `ok/degraded/down`. (Backward compat: any UI consumers update together.) |
| C5 | **P1** | `commons.schema.ts.apiResponseSchema` declares `{ success, data, error, meta }` but no service uses it | web `commons.schema.ts:25-34`      | Delete the dead schema, or fix to match the actual `{ data }` envelope.                                           |
| C6 | **P1** | No liveness/readiness split                                                                             | `app/api/health/route.ts`          | Add `/api/health/live` (always 200, no deps probed). Treat `/api/health` as readiness.                            |
| C7 | **P1** | `unhandled` error path returns `err.message` to client (may leak internals)                            | `middlewares/with-error-handler.ts`| Map known error types to safe messages; for the rest return `'Internal server error'` and log `err` server-side.   |
| C8 | **P1** | SQL string interpolation for non-ad-hoc queries (segment, category) — safe today, fragile pattern     | `gold-queries/repositories/duckdb.repository.ts:74-95` | Use DuckDB prepared-statement binding when available, or escape single quotes and validate against the same Zod enum the schema enforces. |
| C9 | **P1** | Ad-hoc DuckDB query has no per-query timeout                                                            | `gold-queries/.../duckdb.repository.ts:46` | Wrap in `Promise.race([query, sleep(MAX_QUERY_TIMEOUT_MS)])` and abort the DuckDB connection. |
| C10 | **P2** | `process.on(SIGTERM/SIGINT)` not registered                                                              | `apps/api/src`                    | Add `instrumentation.ts` for Next 15 with cleanup hooks.                                                          |
| C11 | **P2** | Per-check timeout on deep health (kafkajs can block 5–15s in partial outage)                            | `health.service.ts`               | Wrap each check in `Promise.race` with 2s timeout.                                                                |
| C12 | **P2** | `VITE_ENABLE_MOCK` declared but never branched on in production                                          | `web/src/config/config.ts:4`       | Either delete the flag, or wire it into a dev-only `?mock=1` query param and label mock data clearly.            |
| C13 | **P2** | No security boundary doc                                                                                 | repo root                         | Add `SECURITY.md`: "API has no auth. All destructive endpoints must be firewalled at the network layer."          |
| C14 | **P3** | API tests are Zod-only; no HTTP integration tests                                                       | `apps/api/tests/integration/*`     | Add a `apps/api/tests/integration/http/*.test.ts` that boots the route handler with `createRouteHandler` + mocked infra. |
| C15 | **P3** | Web typecheck fails on 2 test files (missing `@testing-library/jest-dom` types)                        | `apps/web/src/components/__tests__/*` | Add to vitest setup. |
| C16 | **P3** | `jsdom` not installed; web vitest cannot start                                                          | `apps/web` pnpm state             | `pnpm add -D jsdom` in `apps/web`.                                                                                |

---

## 14. Recommended next step (Phase 7 candidate)

The audit's top three **contract-safe** fixes (no API response changes, no consumer-side churn):

1. **C1** (1 line in `health.service.ts`) — fix the Mongo churn.
2. **C2** (wrap 6 dangerous routes with `withRateLimit`) — wire up the existing middleware.
3. **C3** (remove the dead `Authorization: Bearer` interceptor, or add a real stub that returns 401) — close the auth footgun.

Each is ≤ 30 lines of diff. All are backward-compatible. After these, the API and web are ready for a Phase 7 "smoke test with Docker up" pass.

---

## 15. What I did NOT do

- Did not run `make up` / smoke (Docker not reachable from this sandbox).
- Did not modify any `apps/api/src/**` or `apps/web/src/**` file — **audit only.**
- Did not propose a contract change. All recommendations are backward-compatible.
- Did not propose a new auth system (per the prompt: "Don't add a full auth system if not yet approved").
- Did not fix the `apps/api` missing `node_modules` (Phase 4 P0 blocker that the Phase 4 audit flagged).
- Did not validate Airflow reachability for `/api/airflow/dags/...` endpoints (no Airflow running in this sandbox).
