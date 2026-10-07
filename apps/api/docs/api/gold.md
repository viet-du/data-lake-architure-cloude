# Gold API — 18 endpoints

Quản lý lớp Gold (aggregated + business SQL queries).

## Tables

### `GET /api/gold/tables`

```bash
curl -s http://localhost:3001/api/gold/tables | jq
```

### `GET /api/gold/tables/{table}`

```bash
curl -s http://localhost:3001/api/gold/tables/customer_revenue_monthly | jq
```

### `GET /api/gold/tables/{table}/sample?limit=10`

```bash
curl -s "http://localhost:3001/api/gold/tables/customer_revenue_monthly/sample?limit=10" | jq
```

### `GET /api/gold/tables/{table}/history`

```bash
curl -s "http://localhost:3001/api/gold/tables/customer_revenue_monthly/history?limit=5" | jq
```

### `GET /api/gold/tables/{table}/stats`

```bash
curl -s http://localhost:3001/api/gold/tables/customer_revenue_monthly/stats | jq
```

### `GET /api/gold/tables/{table}/lineage` — Lineage về Silver

```bash
curl -s http://localhost:3001/api/gold/tables/customer_revenue_monthly/lineage | jq
```

## Aggregates

### `POST /api/gold/tables/{table}/aggregate` — Single aggregate run

```bash
curl -s -X POST http://localhost:3001/api/gold/tables/customer_revenue_monthly/aggregate \
  -H 'Content-Type: application/json' \
  -d '{"source":"silver.orders_clean","groupBy":["customer_id","month"],"metric":"sum(amount)","partition":"2025-01"}' | jq
```

### `POST /api/gold/aggregate-all` — Run all Gold aggregates

```bash
curl -s -X POST http://localhost:3001/api/gold/aggregate-all \
  -H 'Content-Type: application/json' \
  -d '{"partition":"2025-01"}' | jq
```

### `POST /api/gold/tables/{table}/refresh`

```bash
curl -s -X POST http://localhost:3001/api/gold/tables/customer_revenue_monthly/refresh | jq
```

## Jobs

### `GET /api/gold/jobs`

```bash
curl -s "http://localhost:3001/api/gold/jobs?status=running" | jq
```

### `GET /api/gold/jobs/{jobId}`

```bash
curl -s http://localhost:3001/api/gold/jobs/<jobId> | jq
```

### `GET /api/gold/jobs/stats`

```bash
curl -s http://localhost:3001/api/gold/jobs/stats | jq
```

## Business SQL (DuckDB sandboxed)

Tất cả 5 endpoint dưới đây chạy SQL qua DuckDB với SELECT-only whitelist.

### `GET /api/gold/sql/business-metrics` — Tổng GMV / order count / AOV

```bash
curl -s http://localhost:3001/api/gold/sql/business-metrics | jq
```

### `GET /api/gold/sql/customer-analytics` — Top customers theo LTV

```bash
curl -s "http://localhost:3001/api/gold/sql/customer-analytics?limit=20" | jq
```

### `GET /api/gold/sql/product-performance` — Best sellers theo category

```bash
curl -s "http://localhost:3001/api/gold/sql/product-performance?category=phone" | jq
```

### `GET /api/gold/sql/category-revenue` — Daily revenue theo category

```bash
curl -s "http://localhost:3001/api/gold/sql/category-revenue?from=2025-01-01&to=2025-01-31" | jq
```

### `POST /api/gold/sql/sandbox` — Ad-hoc SELECT

```bash
curl -s -X POST http://localhost:3001/api/gold/sql/sandbox \
  -H 'Content-Type: application/json' \
  -d '{"sql":"SELECT category, COUNT(*) FROM silver.orders_clean GROUP BY category LIMIT 5","limit":100}' | jq
```

> **Lưu ý:** sandbox chỉ chạy SELECT/WITH; DROP/DELETE/UPDATE/INSERT/CREATE/ALTER sẽ bị reject với 400 `SQL_NOT_ALLOWED`.