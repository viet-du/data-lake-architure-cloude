# API Endpoints

All endpoints live under `/api/` and are served by `apps/api` (Next.js Route Handlers). The base URL for local dev is `http://localhost:3001`.

Conventions:

- All responses follow the shape `{ "success": boolean, "data": T, "error"?: { "code": string, "message": string } }`.
- Validation is done with Zod (see `docs/api/schemas.md`).
- Mutations are idempotent where possible.

## Catalog (`/api/catalog`)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/catalog/databases` | List Hive databases |
| GET | `/catalog/databases/:db/tables` | List tables in a database |
| GET | `/catalog/tables/:table` | Get table details |
| GET | `/catalog/tables/:table/schema` | Get column schema |
| GET | `/catalog/search?q=...` | Full-text search across tables |
| GET | `/catalog/health` | Catalog service health |

## Bronze (`/api/bronze`)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/bronze/jobs` | List ingestion jobs |
| GET | `/bronze/jobs/:id` | Get a specific job |
| POST | `/bronze/jobs/:id/run` | Trigger a job (sync) |
| POST | `/bronze/jobs/:id/run-async` | Trigger a job (async) |
| GET | `/bronze/jobs/:id/runs` | List runs of a job |
| GET | `/bronze/runs/:runId` | Get run details |
| GET | `/bronze/runs/:runId/items` | Get row-level results |
| GET | `/bronze/tables` | List bronze tables |
| GET | `/bronze/tables/:table/partitions` | List partitions |
| GET | `/bronze/stats` | Aggregate stats |

## Silver (`/api/silver`)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/silver/tables` | List silver tables |
| GET | `/silver/tables/:table` | Get silver table info |
| GET | `/silver/tables/:table/preview` | Preview rows |
| GET | `/silver/tables/:table/lineage` | Upstream lineage |
| GET | `/silver/runs` | List silver runs |
| GET | `/silver/runs/:runId` | Get silver run details |
| GET | `/silver/stats` | Silver zone stats |

## Gold (`/api/gold`)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/gold/datasets` | List gold datasets (facts + dims + aggregates) |
| GET | `/gold/datasets/:id` | Get dataset metadata |
| GET | `/gold/datasets/:id/preview` | Preview rows |
| GET | `/gold/kpis` | List KPI definitions |
| GET | `/gold/dashboards` | List dashboards |
| GET | `/gold/dashboards/:id/widgets` | Get widgets for a dashboard |
| GET | `/gold/stats` | Gold zone stats |

## Crawler (`/api/crawler`)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/crawler/jobs` | List crawler jobs |
| GET | `/crawler/jobs/:name` | Get one crawler job |
| GET | `/crawler/jobs/:name/config` | Get config |
| PUT | `/crawler/jobs/:name/config` | Update config |
| GET | `/crawler/jobs/:name/kafka-topic` | Linked Kafka topic |
| POST | `/crawler/jobs/:name/run` | Run synchronously |
| POST | `/crawler/jobs/:name/run-async` | Run asynchronously |
| POST | `/crawler/jobs/:name/stop` | Stop a running job |
| GET | `/crawler/jobs/:name/preview` | Preview scraped items |
| GET | `/crawler/jobs/:name/runs` | List runs |
| GET | `/crawler/jobs/:name/runs/:runId` | Get run details |
| GET | `/crawler/jobs/:name/runs/:runId/items` | Get run items |
| GET | `/crawler/stats` | Crawler aggregate stats |

## Kafka (`/api/kafka`)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/kafka/topics` | List topics |
| GET | `/kafka/topics/:topic` | Get topic details |
| DELETE | `/kafka/topics/:topic` | Delete a topic |
| GET | `/kafka/topics/:topic/messages` | Tail messages |
| POST | `/kafka/topics/:topic/produce` | Produce one message |
| POST | `/kafka/topics/:topic/produce-batch` | Produce many messages |
| GET | `/kafka/consumer-groups` | List consumer groups |
| GET | `/kafka/consumer-groups/:groupId` | Get one group |
| DELETE | `/kafka/consumer-groups/:groupId` | Delete a group |
| GET | `/kafka/consumer-groups/:groupId/lag` | Get lag |
| POST | `/kafka/consumer-groups/:groupId/reset-offset` | Reset offset |
| GET | `/kafka/cluster` | Cluster metadata |
| GET | `/kafka/stats` | Aggregate stats |

## Airflow (`/api/airflow`)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/airflow/dags` | List DAGs |
| GET | `/airflow/dags/:dagId` | Get DAG details |
| POST | `/airflow/dags/:dagId/trigger` | Trigger a DAG run |
| POST | `/airflow/dags/:dagId/pause` | Pause a DAG |
| POST | `/airflow/dags/:dagId/unpause` | Unpause a DAG |
| GET | `/airflow/dags/:dagId/runs` | List DAG runs |
| GET | `/airflow/dags/:dagId/runs/:runId` | Get DAG run details |
| DELETE | `/airflow/dags/:dagId/runs/:runId` | Delete a DAG run |
| GET | `/airflow/dags/:dagId/runs/:runId/tasks` | List task instances |
| GET | `/airflow/dags/:dagId/runs/:runId/tasks/:taskId/logs` | Get task logs |
| GET | `/airflow/dags/:dagId/runs/:runId/gantt` | Gantt timeline |
| GET | `/airflow/health` | Airflow health |
| GET | `/airflow/stats` | Aggregate stats |

## Data Quality (`/api/dq`)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/dq/rules` | List DQ rules |
| GET | `/dq/rules/:ruleId` | Get rule details |
| POST | `/dq/rules` | Create a rule |
| PUT | `/dq/rules/:ruleId` | Update a rule |
| DELETE | `/dq/rules/:ruleId` | Delete a rule |
| POST | `/dq/rules/:ruleId/run` | Run a single rule |
| POST | `/dq/run-suite` | Run a suite of rules |
| GET | `/dq/presets` | List rule presets |
| GET | `/dq/runs` | List DQ runs |
| GET | `/dq/runs/:runId` | Get DQ run details |
| GET | `/dq/summary` | Aggregate DQ summary |

## Health & Info

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Cross-system health |
| GET | `/info` | Build info (version, commit, time) |
| GET | `/api/docs` | OpenAPI JSON root |
| GET | `/api/docs/openapi.json` | OpenAPI 3.1 spec |
