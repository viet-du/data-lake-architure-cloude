# Quickstart (5 minutes)

This guide gets the Control Plane running locally on a fresh clone.

## 0. Prerequisites

| Tool | Version |
| --- | --- |
| Node.js | 20.x or 22.x |
| pnpm | 9.x or 10.x |
| Docker | 24+ with Compose v2 |
| Python | 3.10+ (only for `lakehouse` Python jobs) |

## 1. Install dependencies

```bash
pnpm install
```

This installs the JS workspaces (`apps/api`, `apps/web`) and Nx tooling.

## 2. Start the data platform

```bash
docker compose up -d minio minio-init redpanda redpanda-init airflow-webserver airflow-scheduler
```

Services come up on:

| Service | Port |
| --- | --- |
| MinIO API | 9000 |
| MinIO Console | 9001 (`minioadmin / minioadmin`) |
| Redpanda (Kafka) | 9092 |
| Redpanda Console | 8081 |
| Airflow | 8080 (`admin / admin`) |

## 3. Run the Control Plane

```bash
pnpm dev
```

This boots both `apps/api` (http://localhost:3001) and `apps/web` (http://localhost:5173) in parallel.

Or run individually:

```bash
pnpm --filter @lakehouse/api dev
pnpm --filter @lakehouse/web dev
```

## 4. Verify

- Open the UI: http://localhost:5173
- Hit the health endpoint: `curl http://localhost:3001/api/health`
- Check OpenAPI: `curl http://localhost:3001/api/docs/openapi.json | jq`

## 5. Seed sample data (optional)

```bash
pnpm --filter @lakehouse/api seed
```

This runs mock data generators and a smoke test of the bronze → silver → gold chain.

## Common Issues

- **Port 9000 already in use** — stop other MinIO/S3 instances.
- **Airflow not healthy after 60s** — check `docker compose logs airflow-init` for init errors.
- **Vite can't resolve `@/`** — make sure `pnpm install` finished and that you are in the repo root.
