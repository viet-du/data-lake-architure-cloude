# Crawler API — 14 endpoints

Quản lý 5 crawlers (tiki / github / crypto / weather / hackernews) chạy nền qua BullMQ.

## List crawlers

### `GET /api/crawler` — All crawlers

```bash
curl -s http://localhost:3001/api/crawler | jq
```

### `GET /api/crawler/{name}` — Crawler detail

```bash
curl -s http://localhost:3001/api/crawler/hackernews | jq
```

`name` ∈ {`tiki`, `github`, `crypto`, `weather`, `hackernews`}.

## Run crawl

### `POST /api/crawler/{name}/run` — Run sync (đợi kết quả)

```bash
curl -s -X POST http://localhost:3001/api/crawler/hackernews/run \
  -H 'Content-Type: application/json' \
  -d '{"limit":10,"since":"24h","dryRun":false}' | jq
```

### `POST /api/crawler/{name}/run-async` — Queue & chạy nền

```bash
curl -s -X POST http://localhost:3001/api/crawler/hackernews/run-async \
  -H 'Content-Type: application/json' \
  -d '{"limit":50,"since":"week"}' | jq
```

### `POST /api/crawler/{name}/stop` — Cancel in-flight crawl

```bash
curl -s -X POST http://localhost:3001/api/crawler/hackernews/stop \
  -H 'Content-Type: application/json' \
  -d '{"runId":"<runId>"}' | jq
```

## Runs history

### `GET /api/crawler/{name}/runs` — List runs

```bash
curl -s "http://localhost:3001/api/crawler/hackernews/runs?status=success&limit=20" | jq
```

### `GET /api/crawler/{name}/runs/{runId}` — Run detail

```bash
curl -s http://localhost:3001/api/crawler/hackernews/runs/<runId> | jq
```

### `GET /api/crawler/{name}/runs/{runId}/items` — Items collected

```bash
curl -s "http://localhost:3001/api/crawler/hackernews/runs/<runId>/items?limit=100" | jq
```

## Config

### `GET /api/crawler/{name}/config`

```bash
curl -s http://localhost:3001/api/crawler/hackernews/config | jq
```

### `PUT /api/crawler/{name}/config` — Update rate / workers / timeout

```bash
curl -s -X PUT http://localhost:3001/api/crawler/tiki/config \
  -H 'Content-Type: application/json' \
  -d '{"rateLimit":2.0,"maxWorkers":16,"timeout":45}' | jq
```

## Kafka & preview

### `GET /api/crawler/{name}/kafka-topic` — Tìm Kafka topic sink

```bash
curl -s http://localhost:3001/api/crawler/hackernews/kafka-topic | jq
```

### `POST /api/crawler/{name}/preview` — Fetch 1 item mà không lưu

```bash
curl -s -X POST http://localhost:3001/api/crawler/tiki/preview \
  -H 'Content-Type: application/json' \
  -d '{"id":"<item-id>"}' | jq
```

## Stats

### `GET /api/crawler/stats` — Aggregate across all crawlers

```bash
curl -s http://localhost:3001/api/crawler/stats | jq
```