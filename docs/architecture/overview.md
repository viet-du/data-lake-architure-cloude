# System Overview

## Topology

The platform runs as a monorepo with two first-class deployable applications and one Python core package.

```
┌─────────────────────────────┐       ┌─────────────────────────────┐
│   apps/web (Vite + React)   │  HTTP │  apps/api (Next.js 15)      │
│   Control Plane UI :5173    │──────▶│  Control Plane API :3001    │
└─────────────────────────────┘       └──────────────┬──────────────┘
                                                    │
                          ┌─────────────────────────┼─────────────────────────┐
                          ▼                         ▼                         ▼
                  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
                  │   MinIO      │         │  Apache      │         │  Apache      │
                  │   S3 :9000   │         │  Kafka :9092 │         │  Airflow     │
                  │              │         │              │         │  :8080       │
                  └──────────────┘         └──────────────┘         └──────────────┘
                          ▲                         ▲                         ▲
                          │                         │                         │
                          └────────── lakehouse (PySpark + Delta Lake) ──────┘
                                              │
                                              ▼
                                       ┌──────────────┐
                                       │   BI / DQ     │
                                       │  Metabase /   │
                                       │  Great Exp.   │
                                       └──────────────┘
```

## Application Surfaces

| App | Stack | Port | Purpose |
| --- | --- | --- | --- |
| `apps/web` | Vite 5 + React 19 + Tailwind v3 + TanStack Query | 5173 | Control plane UI (catalog, bronze, silver, gold, crawler, kafka, airflow, dq, health) |
| `apps/api` | Next.js 15 (Route Handlers) | 3001 | Control plane API (108 routes) |
| `lakehouse` | PySpark 3.5 + Delta Lake 3 | n/a | Python package: ingestion, transform, aggregation, streaming, crawlers, DQ |

## Data Flow (Lambda)

1. **Ingest (Bronze)**
   - Batch: `lakehouse.batch.ingest` (PySpark writes Delta to `s3a://lake/bronze/<source>/<dataset>/`)
   - Stream: Kafka → Spark Structured Streaming → `s3a://lake/bronze/stream/<topic>/`

2. **Transform (Silver)**
   - `lakehouse.batch.transform` cleanses, deduplicates, casts schema
   - Writes to `s3a://lake/silver/<domain>/<table>/`

3. **Aggregate (Gold)**
   - `lakehouse.batch.aggregate` builds KPIs, dimensions
   - Writes to `s3a://lake/gold/<domain>/<kpi>/`

4. **Serve**
   - Gold tables exposed via Trino/Presto + Metabase dashboards
   - DQ checks (`lakehouse.dq`) run on schedule via Airflow

## Operational Surfaces

- **Orchestration**: Airflow DAGs in `airflow_dags/` (retail_elt_dag, ecommerce_streaming_dag, clickstream_streaming_dag)
- **Storage**: MinIO (S3-compatible) at `s3a://lake/`
- **Catalog**: Hive Metastore pointed at MinIO + Delta Lake
- **Streaming**: Redpanda (Kafka API) for local dev
- **Observability**: Health endpoints at `/api/{bronze,silver,gold,airflow,kafka,crawler,dq,catalog}/health` (or `stats`)

## Control Plane Screens (apps/web)

| Route | Screen | Responsibility |
| --- | --- | --- |
| `/` | Home | Pipeline schematic, KPI overview |
| `/catalog` | Catalog | Browse Hive databases / tables / schemas |
| `/bronze` | Bronze | Raw zone (jobs, tables, partitions) |
| `/silver` | Silver | Cleansed zone (runs, tables) |
| `/gold` | Gold | Curated zone (KPIs, dimensions) |
| `/crawler` | Crawler | Source jobs, runs, preview, trigger |
| `/kafka` | Kafka | Topics, messages, consumer groups, produce |
| `/airflow` | Airflow | DAGs, runs, tasks, gantt, trigger, pause |
| `/dq` | Data Quality | Rules, runs, suite execution, summary |
| `/health` | Health | Cross-system health status |
| `/schematic` | Schematic | Animated pipeline view |
