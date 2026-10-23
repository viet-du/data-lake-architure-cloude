# Documentation

## Start here

1. [`../README.md`](../README.md) — project overview, quick start, and local Gold-to-Metabase setup.
2. [`operations/DEV_LINKS.md`](./operations/DEV_LINKS.md) — local service URLs and workflows.
3. [`architecture/ARCHITECTURE.md`](./architecture/ARCHITECTURE.md) — Bronze → Silver → Gold architecture.
4. [`operations/DATA_LAYOUT.md`](./operations/DATA_LAYOUT.md) — table layout and sample queries.
5. [`operations/docker.md`](./operations/docker.md) — Docker lifecycle and troubleshooting.
6. [`operations/DATABRICKS_SETUP.md`](./operations/DATABRICKS_SETUP.md) — optional Databricks setup.
7. [`METABASE_SHARING.md`](./METABASE_SHARING.md) — securely share the configured dashboard over the Internet.

## Web UI and API

- [`../apps/web/README.md`](../apps/web/README.md) — Web UI screen handoff, API mapping, and implementation checklist.
- [`UI_API_CONNECTIONS.md`](./UI_API_CONNECTIONS.md) — frontend API route families and observed local connection status.
- API Swagger UI: `http://localhost:3001/api/docs`.
- OpenAPI JSON: `http://localhost:3001/api/openapi.json`.
- API implementation details: [`../apps/api/README.md`](../apps/api/README.md).
- Gold-to-Metabase runbook: [`operations/DEV_LINKS.md`](./operations/DEV_LINKS.md#hiển-thị-gold-trên-metabase).

## Operations commands

```bash
# Start the core stack
make up

# Start core services plus API and Web UI
make up-api

# Run the batch retail pipeline
bash scripts/run_batch_pipeline.sh --pipeline batch_retail

# Refresh the PostgreSQL reporting mirror from MinIO Gold Delta
bash scripts/sync_gold_to_metabase.sh

# Check local links and service health
bash scripts/check_dev_links.sh
```

## Documentation map

```text
docs/
├── architecture/   Architecture and data-flow references
├── operations/     Local operations, setup, and runbooks
├── api/            API examples and endpoint-specific material
├── audit/          Audits and verification reports
├── plan/           Design proposals and roadmap
└── archive/        Retired material; verify status before reuse
```
