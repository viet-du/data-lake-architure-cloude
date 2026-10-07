# Docker Reference

## Compose Files

| File | Purpose |
| --- | --- |
| `docker-compose.yml` | Core data platform (MinIO, Redpanda, Airflow, Metabase) |
| `docker-compose-kafka.yml` | Kafka-only overlay (used in CI) |
| `docker-compose.api.yml` | API + Web overlay (adds the Control Plane on top of `docker-compose.yml`) |

## Stack

| Service | Image | Port | Volume |
| --- | --- | --- | --- |
| `minio` | `minio/minio:latest` | 9000 (API), 9001 (Console) | `minio_data:/data` |
| `minio-init` | `minio/mc:latest` | — | — |
| `redpanda` | `redpandadata/redpanda:latest` | 9092 (Kafka), 9644 (Admin) | `redpanda_data:/var/lib/redpanda/data` |
| `redpanda-init` | `redpandadata/redpanda-init` | — | — |
| `airflow-webserver` | custom (see `apps/api/Dockerfile`) | 8080 | `airflow_data:/opt/airflow` |
| `airflow-scheduler` | custom | — | `airflow_data:/opt/airflow` |
| `metabase` | `metabase/metabase:latest` | 3000 | `metabase_data:/metabase-data` |
| `spark-master` | `bitnami/spark:3.5` | 8082 (UI), 7077 | — |
| `spark-worker` | `bitnami/spark:3.5` | 8083 | — |
| `api` | `apps/api/Dockerfile` | 3001 | — |
| `web` | `apps/web/Dockerfile` | 5173 | — |

## Common Commands

```bash
# Start everything
docker compose -f docker-compose.yml -f docker-compose.api.yml up -d

# Tail logs
docker compose logs -f redpanda
docker compose logs -f airflow-webserver

# Tear down (keep volumes)
docker compose down

# Tear down (wipe volumes)
docker compose down -v

# Rebuild a single image
docker compose build api
```

## Networking

All services are on the default Compose network `lakehouse_default`. Service-to-service DNS is provided by Compose.

- `api` calls `http://minio:9000`, `redpanda:9092`, `airflow-webserver:8080`.
- `web` proxies API calls to `http://localhost:3001` (browser) or `http://api:3001` (server-side rendering).
