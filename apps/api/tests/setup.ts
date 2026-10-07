import { beforeAll, afterAll } from 'vitest';

const REQUIRED_ENV: Record<string, string> = {
  MINIO_ENDPOINT: process.env.MINIO_ENDPOINT ?? 'localhost:9000',
  MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
  MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
  MINIO_SECURE: process.env.MINIO_SECURE ?? 'false',
  KAFKA_BOOTSTRAP: process.env.KAFKA_BOOTSTRAP ?? 'localhost:9092',
  KAFKA_SECURITY_PROTOCOL: process.env.KAFKA_SECURITY_PROTOCOL ?? 'PLAINTEXT',
  MONGO_URI: process.env.MONGO_URI ?? 'mongodb://localhost:27017',
  MONGO_DB: process.env.MONGO_DB ?? 'lakehouse_catalog_test',
  REDIS_HOST: process.env.REDIS_HOST ?? 'localhost',
  REDIS_PORT: process.env.REDIS_PORT ?? '6379',
  AIRFLOW_BASE_URL: process.env.AIRFLOW_BASE_URL ?? 'http://localhost:8080/api/v1',
  AIRFLOW_USERNAME: process.env.AIRFLOW_USERNAME ?? 'admin',
  AIRFLOW_PASSWORD: process.env.AIRFLOW_PASSWORD ?? 'admin',
  DUCKDB_MEMORY_LIMIT: process.env.DUCKDB_MEMORY_LIMIT ?? '2GB',
  DUCKDB_THREADS: process.env.DUCKDB_THREADS ?? '2',
  ENV: process.env.ENV ?? 'local',
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'error',
  API_PORT: process.env.API_PORT ?? '3001',
  API_RATE_LIMIT_PER_MIN: process.env.API_RATE_LIMIT_PER_MIN ?? '600',
  API_CORS_ORIGINS: process.env.API_CORS_ORIGINS ?? 'http://localhost:3000',
  API_SWAGGER_ENABLED: process.env.API_SWAGGER_ENABLED ?? 'false',
  DQ_MAX_NULL_PERCENT: process.env.DQ_MAX_NULL_PERCENT ?? '5',
  DQ_FAIL_ON_ERROR: process.env.DQ_FAIL_ON_ERROR ?? 'false',
  CRAWLER_RATE_LIMIT: process.env.CRAWLER_RATE_LIMIT ?? '1',
  CRAWLER_MAX_WORKERS: process.env.CRAWLER_MAX_WORKERS ?? '4',
  CRAWLER_TIMEOUT: process.env.CRAWLER_TIMEOUT ?? '30',
  TIKI_API_BASE: process.env.TIKI_API_BASE ?? 'https://tiki.vn/api/v2',
  SPARK_MASTER: process.env.SPARK_MASTER ?? 'local[*]',
  SPARK_DRIVER_MEMORY: process.env.SPARK_DRIVER_MEMORY ?? '1g',
  SPARK_EXECUTOR_MEMORY: process.env.SPARK_EXECUTOR_MEMORY ?? '1g',
  DELTA_PACKAGE: process.env.DELTA_PACKAGE ?? 'io.delta:delta-spark_2.12:3.0.0',
  KAFKA_PACKAGE: process.env.KAFKA_PACKAGE ?? 'org.apache.spark:spark-sql-kafka-0-10_2.12:3.4.0',
};

beforeAll(() => {
  for (const [k, v] of Object.entries(REQUIRED_ENV)) {
    process.env[k] = v;
  }
});

afterAll(async () => {});