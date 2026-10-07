# Environment Variables

All variables can live in `.env` (git-ignored) and `.env.example` (committed). The web app reads them via `import.meta.env`, the API via `process.env`.

## Frontend (`apps/web`)

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:3001` | Base URL of `apps/api` |

## Backend (`apps/api`)

| Variable | Default | Description |
| --- | --- | --- |
| `NODE_ENV` | `development` | Node environment |
| `PORT` | `3001` | HTTP port |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins |
| `LOG_LEVEL` | `info` | `trace` / `debug` / `info` / `warn` / `error` |

## Storage (MinIO)

| Variable | Default | Description |
| --- | --- | --- |
| `S3_ENDPOINT` | `http://minio:9000` | S3-compatible endpoint |
| `S3_ACCESS_KEY` | `minioadmin` | Access key |
| `S3_SECRET_KEY` | `minioadmin` | Secret key |
| `S3_BUCKET` | `lake` | Bucket for all Delta tables |
| `S3_REGION` | `us-east-1` | Region (MinIO ignores it) |

## Streaming (Redpanda / Kafka)

| Variable | Default | Description |
| --- | --- | --- |
| `KAFKA_BOOTSTRAP_SERVERS` | `redpanda:9092` | Comma-separated broker list |
| `KAFKA_CONSUMER_GROUP` | `lakehouse` | Default consumer group |
| `KAFKA_AUTO_OFFSET_RESET` | `earliest` | `earliest` / `latest` |

## Orchestration (Airflow)

| Variable | Default | Description |
| --- | --- | --- |
| `AIRFLOW_BASE_URL` | `http://airflow-webserver:8080` | Airflow webserver |
| `AIRFLOW_USERNAME` | `admin` | Airflow user |
| `AIRFLOW_PASSWORD` | `admin` | Airflow password |

## Spark

| Variable | Default | Description |
| --- | --- | --- |
| `SPARK_MASTER_URL` | `spark://spark-master:7077` | Spark master |
| `SPARK_DRIVER_MEMORY` | `1g` | Driver memory |
| `SPARK_EXECUTOR_MEMORY` | `1g` | Executor memory |
| `SPARK_EXECUTOR_CORES` | `1` | Cores per executor |

## Observability

| Variable | Default | Description |
| --- | --- | --- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | (empty) | OTLP collector (e.g. `http://otel:4317`) |
| `SENTRY_DSN` | (empty) | Sentry DSN for error tracking |
