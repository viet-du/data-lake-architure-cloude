import { beforeAll, afterAll } from 'vitest';

import { loadLocalEnv } from '@/config/load-env';

/**
 * The canonical environment must be applied before any test module imports
 * `@/config`, because the environment schema is evaluated at import time.
 *
 * The loader runs in **file** mode on a developer machine, so a stale
 * ambient export (`MINIO_ENDPOINT=127.0.0.1:19000`) cannot shadow the real
 * local deployment. See `apps/api/env-loader.js` for the ownership rules.
 */
loadLocalEnv();

/**
 * Test-pinned variables.
 *
 * These MUST NOT be inherited from the local deployment configuration: a
 * test that writes to the developer's real catalog, or that keeps an
 * authentication switch enabled, is a data-safety and isolation defect.
 *
 * `MONGO_DB` is the critical one. `apps/api/.env.local` declares
 * `MONGO_DB=lakehouse_catalog` — the *development* catalog — while the test
 * suite must only ever write to `lakehouse_catalog_test`. Before this
 * pinning the value was inherited from the ambient environment, so the
 * integration tests were mutating the development catalog.
 */
const TEST_ENV: Record<string, string> = {
  MONGO_DB: 'lakehouse_catalog_test',
  ENV: 'local',
  LOG_LEVEL: 'error',
  API_PORT: '3001',
  API_RATE_LIMIT_PER_MIN: '600',
  API_CORS_ORIGINS: 'http://localhost:3000',
  API_SWAGGER_ENABLED: 'false',
  API_AUTH_ENABLED: 'false',
  API_AUDIT_ENABLED: 'true',
  API_RATE_LIMIT_FAIL_OPEN: 'true',
  DQ_MAX_NULL_PERCENT: '5',
  DQ_FAIL_ON_ERROR: 'false',
};

/**
 * Connection variables.
 *
 * These come from the canonical local configuration so the suite talks to
 * the *same* MinIO / Kafka / Mongo / Redis / Airflow that the application
 * uses. The fallback only applies when the configuration file is absent.
 */
const CONNECTION_ENV: Record<string, string> = {
  MINIO_ENDPOINT: 'localhost:9000',
  MINIO_ACCESS_KEY: 'minioadmin',
  MINIO_SECRET_KEY: 'minioadmin',
  MINIO_SECURE: 'false',
  KAFKA_BOOTSTRAP: 'localhost:9092',
  KAFKA_SECURITY_PROTOCOL: 'PLAINTEXT',
  MONGO_URI: 'mongodb://localhost:27017',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  AIRFLOW_BASE_URL: 'http://localhost:8080/api/v1',
  AIRFLOW_USERNAME: 'admin',
  AIRFLOW_PASSWORD: 'admin',
  DUCKDB_MEMORY_LIMIT: '2GB',
  DUCKDB_THREADS: '2',
  SPARK_MASTER: 'local[*]',
  SPARK_DRIVER_MEMORY: '1g',
  SPARK_EXECUTOR_MEMORY: '1g',
  DELTA_PACKAGE: 'io.delta:delta-spark_2.12:3.0.0',
  KAFKA_PACKAGE: 'org.apache.spark:spark-sql-kafka-0-10_2.12:3.4.0',
  CRAWLER_RATE_LIMIT: '1',
  CRAWLER_MAX_WORKERS: '4',
  CRAWLER_TIMEOUT: '30',
  TIKI_API_BASE: 'https://tiki.vn/api/v2',
};

beforeAll(() => {
  for (const [key, value] of Object.entries(CONNECTION_ENV)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  // Test-pinned values are applied last and always win.
  for (const [key, value] of Object.entries(TEST_ENV)) {
    process.env[key] = value;
  }
});

afterAll(async () => {});
