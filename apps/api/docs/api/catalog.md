# Catalog API — 20 endpoints

Quản lý databases / tables / schema discovery cho data lake.

## Databases

### `GET /api/catalog/databases` — List all databases

```bash
curl -s http://localhost:3001/api/catalog/databases | jq
```

```ts
import type { Database } from '@/modules/catalog/types/database.types';
const data = await api<{ items: Database[] }>('/api/catalog/databases');
```

### `POST /api/catalog/databases` — Create database

```bash
curl -s -X POST http://localhost:3001/api/catalog/databases \
  -H 'Content-Type: application/json' \
  -d '{"name":"ecommerce","description":"E-commerce domain"}' | jq
```

### `GET /api/catalog/databases/{db}` — Database detail

```bash
curl -s http://localhost:3001/api/catalog/databases/ecommerce | jq
```

### `DELETE /api/catalog/databases/{db}` — Drop database

```bash
curl -s -X DELETE http://localhost:3001/api/catalog/databases/ecommerce | jq
```

### `GET /api/catalog/databases/{db}/tables` — Tables in a database

```bash
curl -s http://localhost:3001/api/catalog/databases/ecommerce/tables | jq
```

## Tables

### `GET /api/catalog/tables?layer=bronze&database=ecommerce` — List tables

```bash
curl -s "http://localhost:3001/api/catalog/tables?layer=bronze&database=ecommerce" | jq
```

```ts
const data = await api<{ items: Table[] }>('/api/catalog/tables?layer=bronze');
```

### `GET /api/catalog/tables/{tableId}` — Table detail

```bash
curl -s http://localhost:3001/api/catalog/tables/ecommerce.orders | jq
```

### `PUT /api/catalog/tables/{tableId}` — Update table metadata

```bash
curl -s -X PUT http://localhost:3001/api/catalog/tables/ecommerce.orders \
  -H 'Content-Type: application/json' \
  -d '{"description":"Orders table","tags":["core"]}' | jq
```

### `DELETE /api/catalog/tables/{tableId}` — Drop table

```bash
curl -s -X DELETE http://localhost:3001/api/catalog/tables/ecommerce.orders | jq
```

### `GET /api/catalog/tables/{tableId}/schema` — Column schema

```bash
curl -s http://localhost:3001/api/catalog/tables/ecommerce.orders/schema | jq
```

### `GET /api/catalog/tables/{tableId}/sample?limit=10` — Sample rows

```bash
curl -s "http://localhost:3001/api/catalog/tables/ecommerce.orders/sample?limit=10" | jq
```

### `GET /api/catalog/tables/{tableId}/lineage` — Lineage (Bronze → Silver → Gold)

```bash
curl -s http://localhost:3001/api/catalog/tables/ecommerce.orders/lineage | jq
```

### `GET /api/catalog/tables/{tableId}/stats` — Table stats (row count, file size)

```bash
curl -s http://localhost:3001/api/catalog/tables/ecommerce.orders/stats | jq
```

### `POST /api/catalog/tables/{tableId}/sync` — Force metadata sync

```bash
curl -s -X POST http://localhost:3001/api/catalog/tables/ecommerce.orders/sync | jq
```

## Schemas

### `GET /api/catalog/schemas` — List registered schemas

```bash
curl -s http://localhost:3001/api/catalog/schemas | jq
```

### `GET /api/catalog/schemas/{name}` — Schema detail

```bash
curl -s http://localhost:3001/api/catalog/schemas/ecommerce-orders-v1 | jq
```

## Search & health

### `GET /api/catalog/search?q=order` — Search tables

```bash
curl -s "http://localhost:3001/api/catalog/search?q=order" | jq
```

### `GET /api/catalog/health` — Catalog subsystem health

```bash
curl -s http://localhost:3001/api/catalog/health | jq
```