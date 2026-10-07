# Lakehouse API — Client Examples

Snippets cho 9 nhóm endpoint. Mỗi file có cả **curl** và **TypeScript fetch** (sử dụng kiểu trả về từ `@/modules/<m>`).

Base URL mặc định: `http://localhost:3001`

| Nhóm | File | Endpoints |
|------|------|-----------|
| Catalog (databases, tables, lineage) | [`catalog.md`](./catalog.md) | 20 |
| Bronze (Delta CRUD + jobs) | [`bronze.md`](./bronze.md) | 14 |
| Silver (transform + time-travel) | [`silver.md`](./silver.md) | 14 |
| Gold (aggregates + business SQL) | [`gold.md`](./gold.md) | 18 |
| Crawler (5 crawlers + BullMQ) | [`crawler.md`](./crawler.md) | 14 |
| Kafka (kafkajs topics / producers / lag) | [`kafka.md`](./kafka.md) | 14 |
| Airflow (REST proxy) | [`airflow.md`](./airflow.md) | 13 |
| DQ (rules + runs + presets) | [`dq.md`](./dq.md) | 11 |
| Health (liveness / readiness) | [`health.md`](./health.md) | 4 |

## Quick curl

```bash
# Health
curl -s http://localhost:3001/api/health | jq

# Catalog databases
curl -s http://localhost:3001/api/catalog/databases | jq

# Bronze tables
curl -s "http://localhost:3001/api/bronze/tables?layer=bronze" | jq

# Kafka cluster info
curl -s http://localhost:3001/api/kafka/cluster | jq

# Airflow DAGs
curl -s "http://localhost:3001/api/airflow/dags?limit=10" | jq

# DQ summary
curl -s http://localhost:3001/api/dq/summary | jq
```

## TypeScript fetch helper

```ts
const baseUrl = process.env.API_URL ?? 'http://localhost:3001';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status} ${path}: ${body}`);
  }
  return res.json() as Promise<T>;
}
```

## Lưu ý chung

- Tất cả endpoint đều trả `{ data, requestId, timestamp }` qua `response-builder.ts::ok()`.
- Error trả `{ error: { code, message, status }, requestId, timestamp }` qua `error-builder`.
- Path params dynamic dùng Next.js convention: `[id]`, `[name]`, v.v.
- Request body luôn JSON. Form-data không dùng — file ingest qua `csvUrl` / `jsonUrl` chỉ tới MinIO presigned URL.
- Một số module có smoke script Node chạy được không cần qua HTTP: `tsx src/modules/kafka/scripts/smoke-init.ts`.