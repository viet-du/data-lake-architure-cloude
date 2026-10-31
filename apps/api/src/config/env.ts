import { z } from 'zod';

// The environment schema only *parses* `process.env`. It deliberately does
// NOT import the loader (`./load-env`) because this module is reachable from
// the Edge middleware (`@/middlewares/with-cors` → `@/config`), and the loader
// uses `node:fs`, which the Edge runtime cannot load.
//
// The canonical configuration is applied by the entry points, before any
// module reads `process.env`:
//   - `apps/api/next.config.ts`      → `next dev` / `next start`
//   - `apps/api/src/workers/main.ts` → the BullMQ worker process
//   - `apps/api/tests/setup.ts`      → the test harness
// See `load-env.ts` for the ownership rules and the measured evidence.

const EnvSchema = z.object({
  /**
   * Default **read** source for browsing/catalog screens.
   *
   * MASTER PLAN §02.2: "Databricks and MinIO are not automatically one
   * unified data store." This variable only decides where the control plane
   * *reads* a dataset from by default. It never decides where a mutation
   * executes — that is `LAKEHOUSE_EXECUTION_TARGET` below.
   */
  LAKEHOUSE_DATA_SOURCE: z.enum(['local', 'databricks']).default('local'),
  /**
   * Where ETL/ELT mutations execute.
   *
   * MASTER PLAN §02.2 / §09 (executionTarget field) requires the read source
   * and the execution target to be configured **separately**:
   *
   * - `local_delta_minio` — Spark jobs write Delta tables into MinIO at
   *   `s3://lakehouse/{layer}/{database}/{table}` (the default, and the only
   *   target that is actually provisioned in this deployment).
   * - `databricks_uc` — reserved for a remote Databricks Jobs/Workflows
   *   pipeline. It is **not** implemented here, so every mutation against it
   *   is rejected with `DATABRICKS_READ_ONLY` instead of silently falling
   *   back to MinIO.
   */
  LAKEHOUSE_EXECUTION_TARGET: z
    .enum(['local_delta_minio', 'databricks_uc'])
    .default('local_delta_minio'),
  /**
   * Canonical bucket that holds every medallion layer.
   *
   * MASTER PLAN §05.1 / §10.2: there must be exactly one storage location.
   * The Python lakehouse reads `LAKEHOUSE_BUCKET` (default `lakehouse`) and
   * addresses `s3a://<bucket>/<layer>/<database>/<table>`. The TypeScript
   * control plane must use the same bucket, so it is resolved from the same
   * environment variable instead of being hard-coded in five repositories.
   */
  LAKEHOUSE_BUCKET: z.string().min(1).default('lakehouse'),
  DATABRICKS_HOST: z.string().url().refine((value) => {
    const url = new URL(value);
    return url.protocol === 'https:' && url.pathname === '/' && !url.search && !url.username && !url.password;
  }, 'Use an HTTPS workspace origin without path, query or credentials').optional(),
  DATABRICKS_TOKEN: z.string().min(1).optional(),
  DATABRICKS_WORKSPACE_ID: z.string().regex(/^\d+$/).optional(),
  DATABRICKS_WAREHOUSE_ID: z.string().regex(/^[a-z0-9]+$/).optional(),
  DATABRICKS_HTTP_PATH: z.string().regex(/^\/sql\/1\.0\/warehouses\/[a-z0-9]+$/).optional(),
  DATABRICKS_CATALOG: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/).default('workspace'),
  DATABRICKS_BRONZE_SCHEMA: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/).default('bronze'),
  DATABRICKS_SILVER_SCHEMA: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/).default('silver'),
  DATABRICKS_GOLD_SCHEMA: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/).default('gold'),
  ENV: z.enum(['local', 'dev', 'staging', 'prod']).default('local'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  S3_ENDPOINT: z.string().min(1).optional(),
  S3_ACCESS_KEY: z.string().min(1).optional(),
  S3_SECRET_KEY: z.string().min(1).optional(),
  S3_REGION: z.string().min(1).optional(),
  S3_PATH_STYLE_ACCESS: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .optional(),
  /**
   * Bucket probed by the deep health check and the dashboard storage probe.
   *
   * It must be the SAME canonical bucket that holds the medallion layers —
   * `LAKEHOUSE_BUCKET` (default `lakehouse`), which is also what
   * `src/lakehouse/core/paths.py` addresses as `s3a://<bucket>/...`. Probing
   * a per-layer bucket such as `bronze` returns 404/NoSuchBucket on a stock
   * deployment and makes `/api/health/deep` report the storage layer as down.
   */
  S3_HEALTH_BUCKET: z.string().min(1).default('lakehouse'),
  S3_USE_SSL: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .optional(),

  MINIO_ENDPOINT: z.string().min(1).optional(),
  MINIO_ACCESS_KEY: z.string().min(1).optional(),
  MINIO_SECRET_KEY: z.string().min(1).optional(),
  MINIO_SECURE: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .optional(),

  KAFKA_BOOTSTRAP: z.string().min(1),
  KAFKA_SECURITY_PROTOCOL: z.string().default('PLAINTEXT'),

  MONGO_URI: z.string().default('mongodb://localhost:27017'),
  MONGO_DB: z.string().default('lakehouse_catalog'),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6379),
  REDIS_PASSWORD: z.string().optional(),

  AIRFLOW_BASE_URL: z.string().url().optional(),
  AIRFLOW_USERNAME: z.string().default('admin'),
  AIRFLOW_PASSWORD: z.string().default('admin'),

  API_PORT: z.coerce.number().int().default(3001),
  API_RATE_LIMIT_PER_MIN: z.coerce.number().int().default(600),
  API_CORS_ORIGINS: z.string().default('http://localhost:3000'),
  API_SWAGGER_ENABLED: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .default('true'),

  /**
   * MASTER PLAN §13.1: identity/RBAC is a blocking requirement before broad
   * rollout. The switch defaults to `false` so a local checkout keeps working,
   * but a non-local environment must never start without authentication.
   */
  API_AUTH_ENABLED: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .default('false'),
  /** HMAC secret for session and confirmation tokens (min 32 characters). */
  API_JWT_SECRET: z.string().min(32).default('local-development-only-secret-change-me-32ch'),
  API_SESSION_TTL_SECONDS: z.coerce.number().int().min(60).default(3600),
  API_CONFIRM_TOKEN_TTL_SECONDS: z.coerce.number().int().min(10).default(120),
  /**
   * JSON array of service credentials:
   * `[{"keyId":"...","secretHash":"<sha256 hex>","principalId":"...","role":"operator","scopes":["retail.*"]}]`
   */
  API_SERVICE_KEYS: z.string().default(''),
  /**
   * JSON array of human credentials:
   * `[{"principalId":"...","secretHash":"<sha256 hex>","role":"analyst","scopes":[]}]`
   *
   * Service credentials stay in `API_SERVICE_KEYS` — the plan requires the
   * machine identity and the user identity to remain separate.
   */
  API_USER_CREDENTIALS: z.string().default(''),
  API_AUDIT_ENABLED: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .default('true'),
  /**
   * Rate-limit failure mode.
   *
   * The default is fail-open so an unavailable Redis cannot take the whole
   * control plane down — MASTER PLAN §13.10 requires failure isolation, and
   * the Home dashboard must stay readable when a dependency flaps. Set to
   * `false` to fail closed and reject traffic with 503 instead.
   */
  API_RATE_LIMIT_FAIL_OPEN: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .default('true'),

  DUCKDB_MEMORY_LIMIT: z.string().default('4GB'),
  DUCKDB_THREADS: z.coerce.number().int().default(4),

  TIKI_API_BASE: z.string().default('https://tiki.vn/api/v2'),
  CRAWLER_RATE_LIMIT: z.coerce.number().default(1.0),
  CRAWLER_MAX_WORKERS: z.coerce.number().int().default(8),
  CRAWLER_TIMEOUT: z.coerce.number().int().default(30),

  DQ_MAX_NULL_PERCENT: z.coerce.number().default(5.0),
  DQ_FAIL_ON_ERROR: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .default('false'),
}).superRefine((value, ctx) => {
  const r2EndpointConfigured = Boolean(value.S3_ENDPOINT);
  const requiredStorageValues = [
    ['S3_ENDPOINT', value.S3_ENDPOINT ?? value.MINIO_ENDPOINT],
    [
      'S3_ACCESS_KEY',
      r2EndpointConfigured ? value.S3_ACCESS_KEY : value.MINIO_ACCESS_KEY,
    ],
    [
      'S3_SECRET_KEY',
      r2EndpointConfigured ? value.S3_SECRET_KEY : value.MINIO_SECRET_KEY,
    ],
  ] as const;

  for (const [name, resolved] of requiredStorageValues) {
    if (!resolved) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [name],
        message: `Set ${name} (or its MINIO_* compatibility variable)`,
      });
    }
  }

  // Databricks credentials are required as soon as *either* the read source
  // or the execution target is Databricks. The two are independent settings,
  // so the check can no longer be derived from the read source alone.
  const needsDatabricks =
    value.LAKEHOUSE_DATA_SOURCE === 'databricks' ||
    value.LAKEHOUSE_EXECUTION_TARGET === 'databricks_uc';
  if (!needsDatabricks) return;
  for (const key of ['DATABRICKS_HOST', 'DATABRICKS_TOKEN', 'DATABRICKS_WAREHOUSE_ID'] as const) {
    if (!value[key]) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: 'Required for Databricks data source or execution target' });
  }
  if (value.DATABRICKS_HTTP_PATH && value.DATABRICKS_HTTP_PATH.split('/').at(-1) !== value.DATABRICKS_WAREHOUSE_ID) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['DATABRICKS_HTTP_PATH'], message: 'Warehouse ID and HTTP path must match' });
  }
}).transform((value) => {
  const configuredEndpoint = value.S3_ENDPOINT ?? value.MINIO_ENDPOINT ?? '';
  const endpointHasScheme = /^https?:\/\//i.test(configuredEndpoint);
  const endpointUsesSsl = /^https:\/\//i.test(configuredEndpoint);
  const useSsl = endpointHasScheme
    ? endpointUsesSsl
    : (value.S3_USE_SSL ?? value.MINIO_SECURE ?? false);
  const endpoint = endpointHasScheme
    ? configuredEndpoint
    : `${useSsl ? 'https' : 'http'}://${configuredEndpoint}`;

  return {
    ...value,
    S3_ENDPOINT: endpoint,
    S3_ACCESS_KEY: value.S3_ACCESS_KEY ?? value.MINIO_ACCESS_KEY ?? '',
    S3_SECRET_KEY: value.S3_SECRET_KEY ?? value.MINIO_SECRET_KEY ?? '',
    S3_REGION:
      value.S3_REGION ?? (value.S3_ENDPOINT ? 'auto' : 'us-east-1'),
    S3_PATH_STYLE_ACCESS: value.S3_PATH_STYLE_ACCESS ?? true,
    S3_HEALTH_BUCKET: value.S3_HEALTH_BUCKET,
    S3_USE_SSL: useSsl,
    MINIO_ENDPOINT: endpoint,
    MINIO_ACCESS_KEY: value.S3_ACCESS_KEY ?? value.MINIO_ACCESS_KEY ?? '',
    MINIO_SECRET_KEY: value.S3_SECRET_KEY ?? value.MINIO_SECRET_KEY ?? '',
    MINIO_SECURE: useSsl,
  };
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment variables:\n${issues}`);
}

export const env = parsed.data;
export type Env = z.infer<typeof EnvSchema>;