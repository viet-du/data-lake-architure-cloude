# Bronze API — 14 endpoints

Quản lý lớp Bronze (raw ingested) trên Delta Lake trong MinIO.

## Tables

### `GET /api/bronze/tables` — List Bronze tables

```bash
curl -s "http://localhost:3001/api/bronze/tables?database=ecommerce" | jq
```

### `GET /api/bronze/tables/{table}` — Table detail

```bash
curl -s http://localhost:3001/api/bronze/tables/orders | jq
```

### `GET /api/bronze/tables/{table}/sample?limit=10` — Sample rows

```bash
curl -s "http://localhost:3001/api/bronze/tables/orders/sample?limit=10" | jq
```

### `GET /api/bronze/tables/{table}/partitions` — Partitions

```bash
curl -s http://localhost:3001/api/bronze/tables/orders/partitions | jq
```

### `GET /api/bronze/tables/{table}/history` — Delta log history

```bash
curl -s "http://localhost:3001/api/bronze/tables/orders/history?limit=10" | jq
```

### `GET /api/bronze/tables/{table}/stats` — Stats (rows, size, files)

```bash
curl -s http://localhost:3001/api/bronze/tables/orders/stats | jq
```

### `POST /api/bronze/tables/{table}/vacuum` — Vacuum old files

```bash
curl -s -X POST http://localhost:3001/api/bronze/tables/orders/vacuum \
  -H 'Content-Type: application/json' \
  -d '{"retainHours":168}' | jq
```

### `DELETE /api/bronze/tables/{table}/partitions/{partition}` — Drop partition

```bash
curl -s -X DELETE "http://localhost:3001/api/bronze/tables/orders/partitions/partition=2025-01-01" | jq
```

## Ingest

### `POST /api/bronze/tables/{table}/ingest/csv` — Ingest CSV

```bash
curl -s -X POST http://localhost:3001/api/bronze/tables/orders/ingest/csv \
  -H 'Content-Type: application/json' \
  -d '{"csvUrl":"http://minio:9000/lakehouse/raw/orders/2025-01-01.csv","partition":"2025-01-01"}' | jq
```

### `POST /api/bronze/tables/{table}/ingest/json` — Ingest JSON

```bash
curl -s -X POST http://localhost:3001/api/bronze/tables/orders/ingest/json \
  -H 'Content-Type: application/json' \
  -d '{"jsonUrl":"http://minio:9000/lakehouse/raw/orders/2025-01-01.json"}' | jq
```

### `POST /api/bronze/tables/{table}/ingest/stream` — Stream ingest (JSON array body)

```bash
curl -s -X POST http://localhost:3001/api/bronze/tables/orders/ingest/stream \
  -H 'Content-Type: application/json' \
  -d '{"rows":[{"order_id":"o-001","amount":120.5}]}' | jq
```

## Jobs

### `GET /api/bronze/jobs` — List ingest/transform jobs

```bash
curl -s "http://localhost:3001/api/bronze/jobs?status=running" | jq
```

### `GET /api/bronze/jobs/{jobId}` — Job detail

```bash
curl -s http://localhost:3001/api/bronze/jobs/<jobId> | jq
```

### `GET /api/bronze/jobs/stats` — Jobs aggregate stats

```bash
curl -s http://localhost:3001/api/bronze/jobs/stats | jq
```