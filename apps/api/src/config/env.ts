import { z } from 'zod';

const EnvSchema = z.object({
  LAKEHOUSE_DATA_SOURCE: z.enum(['local', 'databricks']).default('local'),
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

  MINIO_ENDPOINT: z.string().min(1).refine((value) => !value.includes('://') && !value.includes('/'), 'Use hostname:port without a URL scheme or path'),
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(1),
  MINIO_SECURE: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .default('false'),

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
  API_CORS_ORIGINS: z.string().default('http://localhost:5173,http://127.0.0.1:5173'),
  API_SWAGGER_ENABLED: z
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
}).superRefine((value, context) => {
  if (value.LAKEHOUSE_DATA_SOURCE !== 'databricks') return;
  for (const key of ['DATABRICKS_HOST', 'DATABRICKS_TOKEN', 'DATABRICKS_WAREHOUSE_ID'] as const) {
    if (!value[key]) context.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: 'Required for Databricks data source' });
  }
  if (value.DATABRICKS_HTTP_PATH && value.DATABRICKS_HTTP_PATH.split('/').at(-1) !== value.DATABRICKS_WAREHOUSE_ID) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['DATABRICKS_HTTP_PATH'], message: 'Warehouse ID and HTTP path must match' });
  }
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment variables:\n${issues}`);
}

export const env = parsed.data;
export type Env = z.infer<typeof EnvSchema>;
