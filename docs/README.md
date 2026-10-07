# Data Lake Control Plane — Documentation Index

This directory is the canonical source of truth for the **Lakehouse Control Plane** (apps/web + apps/api) and the data platform (Spark / Kafka / Airflow / MinIO / Delta Lake).

## 1. Architecture

| File | Purpose |
| --- | --- |
| [architecture/overview.md](./architecture/overview.md) | System topology, components, data flow |
| [architecture/layers.md](./architecture/layers.md) | Frontend + Backend layered architecture |
| [architecture/medallion.md](./architecture/medallion.md) | Bronze / Silver / Gold data model |
| [architecture/cqrs-events.md](./architecture/cqrs-events.md) | Kafka topic catalog + event contracts |

## 2. API Reference

| File | Purpose |
| --- | --- |
| [api/endpoints.md](./api/endpoints.md) | HTTP endpoint catalog (108 routes) |
| [api/entities.md](./api/entities.md) | TypeScript entity catalog |
| [api/schemas.md](./api/schemas.md) | Zod validation schemas |
| [api/openapi.json](./api/openapi.json) | Generated OpenAPI 3.1 spec (mirrors `/api/docs/openapi.json`) |

## 3. Operations

| File | Purpose |
| --- | --- |
| [operations/quickstart.md](./operations/quickstart.md) | Local development in 5 minutes |
| [operations/docker.md](./operations/docker.md) | Docker Compose stack reference |
| [operations/testing.md](./operations/testing.md) | Unit + integration test guide |
| [operations/environment.md](./operations/environment.md) | Environment variables catalog |
| [operations/ci-cd.md](./operations/ci-cd.md) | CI pipeline + quality gates |
