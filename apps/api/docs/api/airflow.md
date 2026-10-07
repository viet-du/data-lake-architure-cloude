# Airflow API — 13 endpoints (REST proxy)

Proxy sang Apache Airflow REST API v1 (`AIRFLOW_BASE_URL`). Cần auth `AIRFLOW_USERNAME/AIRFLOW_PASSWORD` hoặc `AIRFLOW_API_KEY`.

## DAGs

### `GET /api/airflow/dags?limit=100&onlyActive=false` — List DAGs

```bash
curl -s "http://localhost:3001/api/airflow/dags?limit=100" | jq
```

### `GET /api/airflow/dags/{dagId}` — DAG detail (tasks, params)

```bash
curl -s http://localhost:3001/api/airflow/dags/retail_elt | jq
```

### `POST /api/airflow/dags/{dagId}/trigger` — Trigger 1 run

```bash
curl -s -X POST http://localhost:3001/api/airflow/dags/retail_elt/trigger \
  -H 'Content-Type: application/json' \
  -d '{"conf":{"run_date":"2025-01-15"},"note":"manual API trigger"}' | jq
```

### `POST /api/airflow/dags/{dagId}/pause` — Pause

```bash
curl -s -X POST http://localhost:3001/api/airflow/dags/retail_elt/pause | jq
```

### `POST /api/airflow/dags/{dagId}/unpause` — Unpause

```bash
curl -s -X POST http://localhost:3001/api/airflow/dags/retail_elt/unpause | jq
```

## Runs

### `GET /api/airflow/dags/{dagId}/runs?state=success&limit=25`

```bash
curl -s "http://localhost:3001/api/airflow/dags/retail_elt/runs?state=success&limit=25" | jq
```

### `GET /api/airflow/dags/{dagId}/runs/{runId}`

```bash
curl -s http://localhost:3001/api/airflow/dags/retail_elt/runs/manual__2025-01-15T00:00:00 | jq
```

### `DELETE /api/airflow/dags/{dagId}/runs/{runId}` — Clear run

```bash
curl -s -X DELETE http://localhost:3001/api/airflow/dags/retail_elt/runs/<runId> | jq
```

### `GET /api/airflow/dags/{dagId}/runs/{runId}/tasks` — Task instances

```bash
curl -s http://localhost:3001/api/airflow/dags/retail_elt/runs/<runId>/tasks | jq
```

### `GET /api/airflow/dags/{dagId}/runs/{runId}/tasks/{taskId}/logs?tryNumber=1`

```bash
curl -s "http://localhost:3001/api/airflow/dags/retail_elt/runs/<runId>/tasks/bronze_ingest/logs?tryNumber=1" | jq
```

### `GET /api/airflow/dags/{dagId}/runs/{runId}/gantt` — Gantt timeline

```bash
curl -s http://localhost:3001/api/airflow/dags/retail_elt/runs/<runId>/gantt | jq
```

## Cluster

### `GET /api/airflow/health` — Webserver + scheduler + metadb

```bash
curl -s http://localhost:3001/api/airflow/health | jq
```

### `GET /api/airflow/stats` — Run counts by state

```bash
curl -s http://localhost:3001/api/airflow/stats | jq
```

> Nếu Airflow chưa chạy, `health.reachable=false` và trả `null` health; `stats` sẽ trả 503.