# Health API — 4 endpoints

Readiness / liveness probes cho API + từng dependency.

## API top-level

### `GET /api/health` — API process liveness

```bash
curl -s http://localhost:3001/api/health | jq
```

### `GET /api/health/ready` — Readiness (checks infra connections)

```bash
curl -s http://localhost:3001/api/health/ready | jq
```

## Dependency

### `GET /api/health/dependencies` — Chi tiết MinIO / Mongo / Redis / Kafka / DuckDB

```bash
curl -s http://localhost:3001/api/health/dependencies | jq
```

### `GET /api/catalog/health` — Catalog subsystem riêng

```bash
curl -s http://localhost:3001/api/catalog/health | jq
```