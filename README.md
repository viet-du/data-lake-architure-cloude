# Data Lakehouse

Local-first data lakehouse and control plane for retail batch and streaming
workloads. The core stack stores Bronze, Silver, and Gold Delta tables in
MinIO; Spark processes the data; Kafka and Airflow provide streaming and
orchestration. An optional API and Web UI expose operational tools. Metabase
reads a PostgreSQL mirror of Gold tables.

> Databricks support remains available as an optional storage/query provider.
> The retail batch run and Metabase dashboard described below use the local
> MinIO path, not the separate Databricks demo pipeline.

## Quick start

Requirements: Docker Desktop with Compose, Node.js 20+ and pnpm for local
development. Run commands from the repository root.

```bash
# Configure local services. Never commit .env or real credentials.
cp .env.example .env
# Edit .env if you need non-default local settings.

# Start core services and Kafka.
make up

# Start the optional API + Web control plane.
make up-api

# Run the batch retail pipeline (Bronze -> Silver -> Gold).
bash scripts/run_batch_pipeline.sh --pipeline batch_retail

# Mirror Gold Delta tables from MinIO into PostgreSQL for Metabase.
bash scripts/sync_gold_to_metabase.sh
```

Open the Web UI at <http://localhost:5173>, API docs at
<http://localhost:3001/api/docs>, Metabase at <http://localhost:3000>, and
MinIO Console at <http://localhost:9001>. Local MinIO defaults are
`minioadmin` / `minioadmin`; Airflow defaults are `admin` / `admin`.
Metabase requires its initial account setup.

## Data flow and current reporting setup

```text
CSV/JSON + Kafka
      |
      v
Bronze Delta (MinIO) -> Silver Delta (MinIO) -> Gold Delta (MinIO)
                                                   |
                                      sync_gold_to_metabase.sh
                                                   v
                                       PostgreSQL: gold_analytics
                                                   |
                                                   v
                                           Metabase dashboards
```

MinIO remains the source of truth for the local Delta lake. Metabase does not
read Delta tables directly from MinIO, so `scripts/sync_gold_to_metabase.sh`
replaces the reporting tables in the local `gold_analytics` PostgreSQL
database. Run it again after a pipeline refresh.

The local mirror includes:

| PostgreSQL table | Verified rows in the current local run |
|---|---:|
| `public.fact_orders` | 222 |
| `public.daily_revenue` | 175 |
| `public.dim_customers` | 200 |
| `public.dim_products` | 50 |

Connect Metabase with database type **PostgreSQL**:

| Field | Value |
|---|---|
| Display name | `Lakehouse Gold (MinIO)` |
| Host | `gold-postgres` |
| Port | `5432` |
| Database | `gold_analytics` |
| Username | `metabase` by default |
| Password | `lakehouse-local` by default; override using `GOLD_POSTGRES_PASSWORD` |

The PostgreSQL service is also exposed to the host on `localhost:5433`.
The current local Metabase dashboard is [Tổng quan Lakehouse](http://localhost:3000/dashboard/2-t-ng-quan-lakehouse).
For secure Internet sharing with a friend, use
[`docs/METABASE_SHARING.md`](./docs/METABASE_SHARING.md). The local URL is
not reachable from another computer, and sharing the dashboard does not
require a Metabase API token.

## Web UI API connections

The [Web UI handoff README](./apps/web/README.md) lists the required screens,
UI components, API mapping, and frontend implementation rules. The separate
[Web UI API connections README](./docs/UI_API_CONNECTIONS.md) records route
families and observed local connection checks.

## Main services

| Service | Local address | Purpose |
|---|---|---|
| MinIO API / Console | `localhost:9000` / <http://localhost:9001> | S3 storage for Delta layers |
| Spark UI | <http://localhost:8080> | Spark cluster |
| Kafka broker / UI | `localhost:9092` / <http://localhost:8081> | Streaming |
| Airflow | <http://localhost:8088> | Pipeline orchestration |
| API / Swagger | <http://localhost:3001> | Control-plane API |
| Web UI | <http://localhost:5173> | Lakehouse tools dashboard |
| Gold PostgreSQL | `localhost:5433` | Metabase reporting mirror |
| Metabase | <http://localhost:3000> | BI and dashboarding |

Use `make help` for the repository's supported commands. Core stack lifecycle
and additional service information are documented in
[`docs/operations/DEV_LINKS.md`](./docs/operations/DEV_LINKS.md).

## Repository map

```text
apps/api/               Next.js API, OpenAPI routes, service modules
apps/web/               React/Vite control-plane UI
airflow_dags/           Airflow DAG definitions
data-samples/           Local retail pipeline inputs
scripts/                Pipeline, verification, and Gold mirror commands
src/lakehouse/          Spark ingestion, transforms, aggregation, storage
docker-compose*.yml     Local services and optional API/Web overlay
docs/                   Architecture, operations, API and setup guides
```

## Environment and security

- Start from [`.env.example`](./.env.example); local `.env` files are ignored.
- Do not put PATs, OAuth secrets, or cloud credentials in README files,
  screenshots, commits, or browser URLs.
- For Databricks, use a newly rotated token stored only in a local ignored env
  file or the Databricks connection form. See
  [`docs/operations/DATABRICKS_SETUP.md`](./docs/operations/DATABRICKS_SETUP.md).
- `GOLD_POSTGRES_USER` and `GOLD_POSTGRES_PASSWORD` configure the local
  reporting mirror. Change the development defaults before exposing services
  outside the local machine.

## Validation and troubleshooting

```bash
# Check that the Compose model is valid.
docker compose -f docker-compose.yml -f docker-compose-kafka.yml config --quiet

# Verify pipeline data and Delta tables.
bash scripts/verify_phase3.sh

# Verify service endpoints.
bash scripts/check_dev_links.sh

# Check current mirrored reporting tables.
docker exec lake-gold-postgres psql -U metabase -d gold_analytics \
  -c '\dt public.*'
```

If a Web UI page cannot load data, check the API and dependency statuses in
the [Web UI API connections README](./docs/UI_API_CONNECTIONS.md), then inspect
the API route implementation and available docs. If Metabase does not show
newly built Gold data, rerun
`bash scripts/sync_gold_to_metabase.sh`, then sync the database schema in
Metabase.

## Further reading

- [Documentation index](./docs/README.md)
- [Local service URLs and workflows](./docs/operations/DEV_LINKS.md)
- [Docker operations](./docs/operations/docker.md)
- [API implementation and docs](./apps/api/README.md)
- [Databricks setup](./docs/operations/DATABRICKS_SETUP.md)
