# Data Quality API — 11 endpoints

Quản lý rule definitions, chạy rule/suite qua DuckDB SQL assertions, lưu lịch sử vào MongoDB.

## Rules

### `GET /api/dq/rules?layer=bronze&enabled=true&limit=100` — List rules

```bash
curl -s "http://localhost:3001/api/dq/rules?layer=bronze&enabled=true" | jq
```

### `POST /api/dq/rules` — Create rule

```bash
curl -s -X POST http://localhost:3001/api/dq/rules \
  -H 'Content-Type: application/json' \
  -d '{
    "name":"orders order_id not null",
    "type":"null_check",
    "layer":"bronze",
    "table":"ecommerce/orders",
    "column":"order_id",
    "params":{"maxNullPercent":0},
    "severity":"critical",
    "tags":["bronze","orders","not-null"]
  }' | jq
```

### `GET /api/dq/rules/{ruleId}`

```bash
curl -s http://localhost:3001/api/dq/rules/<ruleId> | jq
```

### `PUT /api/dq/rules/{ruleId}` — Update

```bash
curl -s -X PUT http://localhost:3001/api/dq/rules/<ruleId> \
  -H 'Content-Type: application/json' \
  -d '{"enabled":false,"severity":"low"}' | jq
```

### `DELETE /api/dq/rules/{ruleId}`

```bash
curl -s -X DELETE http://localhost:3001/api/dq/rules/<ruleId> | jq
```

## Run

### `POST /api/dq/rules/{ruleId}/run` — Single rule

```bash
curl -s -X POST http://localhost:3001/api/dq/rules/<ruleId>/run \
  -H 'Content-Type: application/json' \
  -d '{"partition":"2025-01","limit":1000,"sampleSize":10}' | jq
```

### `POST /api/dq/run-suite` — Suite of rules

```bash
curl -s -X POST http://localhost:3001/api/dq/run-suite \
  -H 'Content-Type: application/json' \
  -d '{"name":"nightly-check","ruleIds":["<id1>","<id2>"],"partition":"2025-01","limit":1000}' | jq
```

## Run history

### `GET /api/dq/runs?ruleId=...&status=fail&limit=50`

```bash
curl -s "http://localhost:3001/api/dq/runs?status=fail&limit=20" | jq
```

### `GET /api/dq/runs/{runId}`

```bash
curl -s http://localhost:3001/api/dq/runs/<runId> | jq
```

## Summary & presets

### `GET /api/dq/summary` — Dashboard (pass rate, byLayer, topFailed, recentRuns)

```bash
curl -s http://localhost:3001/api/dq/summary | jq
```

### `GET /api/dq/presets` — Preset rule templates

```bash
curl -s http://localhost:3001/api/dq/presets | jq
```

## Rule types

| Type          | params shape                                | Yêu cầu |
| ------------- | ------------------------------------------- | -------- |
| `null_check`   | `{ maxNullPercent?: number }`               | `column` |
| `range_check` | `{ min?: number, max?: number }`            | `column` |
| `in_set`      | `{ values: (string|number)[] }`             | `column` |
| `unique`      | `{}`                                        | `column` |
| `regex`       | `{ pattern: string }`                       | `column` |
| `custom_sql`  | `{ sql: string }` (SELECT/WITH only, ${table} placeholder) | `table` |

> `custom_sql` chỉ chấp nhận SELECT / WITH. DROP / DELETE / UPDATE / INSERT / CREATE / TRUNCATE / ALTER bị reject.