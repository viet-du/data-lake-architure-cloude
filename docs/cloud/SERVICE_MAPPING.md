# Service-to-Host Mapping (Local Docker)

> All compute and orchestration run directly on this Mac in Docker Compose. Cloudflare R2 is optional object storage only.

## Quick reference

| Need | Where | Access |
| --- | --- | --- |
| Web UI | Docker Compose service `lake-web` | `http://localhost:5173` |
| API | Docker Compose service `lake-api` | `http://localhost:3001` |
| Delta/object storage | MinIO container or optional Cloudflare R2 | MinIO `http://localhost:9000` |
| Spark | `lake-spark-master` + `lake-spark-worker` | Spark UI `http://localhost:8080` |
| Airflow | `lake-airflow-webserver` + scheduler | `http://localhost:8088` |
| Kafka | Kafka + Zookeeper containers | `localhost:9092` |
| Kafka UI | `lake-kafka-ui` | `http://localhost:8081` |
| Metabase | `lake-metabase` | `http://localhost:3000` |
| MongoDB | `lake-mongo` | `localhost:27017` |
| Redis | `lake-redis` | `localhost:6379` |

## Compose commands

```bash
# Core tools: storage, Spark, Airflow, Kafka, Metabase, Mongo, Redis
make up

# Core tools plus API and Web
make up-api

# Check containers
make ps

# Stop containers but keep persistent volumes
make down
make down-api
```

The compose files are:

- `docker-compose.yml`: MinIO, Spark, Airflow, Metabase, Mongo and Redis.
- `docker-compose-kafka.yml`: Kafka, Zookeeper, Kafka UI and topic initialization.
- `docker-compose.dev-api.yml`: local API and Web overlay.

## Storage modes

| Mode | Compute | Storage | Configuration |
| --- | --- | --- | --- |
| Local default | Local Docker containers | MinIO | `MINIO_ENDPOINT=minio:9000` inside Compose |
| Local with cloud storage | Local Docker containers | Cloudflare R2 | Set `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` in git-ignored `.env` |

R2 does not run Spark, Airflow, Kafka, API or Web. It is only an optional S3-compatible storage backend.

## Service communication

Inside the Compose network, services use service names rather than `localhost`:

- API connects to `mongo`, `redis`, `minio`, `kafka` and `airflow-webserver`.
- Spark connects to `minio` and `kafka`.
- Airflow runs local DAG tasks and can submit Spark jobs to `lake-spark-master`.
- Web calls the API through the host URL `http://localhost:3001`.

## Adding a service

1. Add or update the service in the appropriate Compose file.
2. Add its health check and persistent volume if it stores state.
3. Add its local URL to `docs/operations/DEV_LINKS.md`.
4. Update this mapping and the relevant runbook.
5. Validate with `docker compose ... config --quiet` before starting it.
