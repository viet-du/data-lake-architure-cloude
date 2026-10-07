# Silver API — 14 endpoints

Quản lý lớp Silver (cleaned, deduped) với time-travel & diff giữa các version.

## Tables

### `GET /api/silver/tables` — List Silver tables

```bash
curl -s http://localhost:3001/api/silver/tables | jq
```

### `GET /api/silver/tables/{table}` — Table detail

```bash
curl -s http://localhost:3001/api/silver/tables/orders_clean | jq
```

### `GET /api/silver/tables/{table}/sample?limit=10`

```bash
curl -s "http://localhost:3001/api/silver/tables/orders_clean/sample?limit=10" | jq
```

### `GET /api/silver/tables/{table}/partitions`

```bash
curl -s http://localhost:3001/api/silver/tables/orders_clean/partitions | jq
```

### `GET /api/silver/tables/{table}/history`

```bash
curl -s "http://localhost:3001/api/silver/tables/orders_clean/history?limit=10" | jq
```

### `GET /api/silver/tables/{table}/stats`

```bash
curl -s http://localhost:3001/api/silver/tables/orders_clean/stats | jq
```

## Transforms

### `POST /api/silver/tables/{table}/transform` — Run dedupe/normalize

```bash
curl -s -X POST http://localhost:3001/api/silver/tables/orders_clean/transform \
  -H 'Content-Type: application/json' \
  -d '{"source":"bronze.orders","dedupeKey":"order_id","partition":"2025-01-01"}' | jq
```

### `POST /api/silver/tables/{table}/transform-all` — Transform all partitions

```bash
curl -s -X POST http://localhost:3001/api/silver/tables/orders_clean/transform-all \
  -H 'Content-Type: application/json' \
  -d '{"source":"bronze.orders","dedupeKey":"order_id"}' | jq
```

## Time travel

### `GET /api/silver/tables/{table}/version/{version}` — Read at version

```bash
curl -s http://localhost:3001/api/silver/tables/orders_clean/version/3 | jq
```

### `GET /api/silver/tables/{table}/diff?from=2&to=3` — Diff two versions

```bash
curl -s "http://localhost:3001/api/silver/tables/orders_clean/diff?from=2&to=3" | jq
```

### `POST /api/silver/tables/{table}/refresh` — Re-read metadata từ MinIO

```bash
curl -s -X POST http://localhost:3001/api/silver/tables/orders_clean/refresh | jq
```

## Jobs

### `GET /api/silver/jobs`

```bash
curl -s "http://localhost:3001/api/silver/jobs?status=success" | jq
```

### `GET /api/silver/jobs/{jobId}`

```bash
curl -s http://localhost:3001/api/silver/jobs/<jobId> | jq
```

### `GET /api/silver/jobs/stats`

```bash
curl -s http://localhost:3001/api/silver/jobs/stats | jq
```