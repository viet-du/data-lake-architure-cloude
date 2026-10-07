# Kafka API — 14 endpoints (kafkajs)

Quản lý Kafka topics, produce/consume messages, consumer groups, lag, cluster info.

## Topics

### `GET /api/kafka/topics?limit=50` — List topics

```bash
curl -s "http://localhost:3001/api/kafka/topics?limit=50" | jq
```

### `POST /api/kafka/topics` — Create topic

```bash
curl -s -X POST http://localhost:3001/api/kafka/topics \
  -H 'Content-Type: application/json' \
  -d '{"name":"orders.events","partitions":6,"replicationFactor":1,"retentionMs":604800000,"configEntries":[{"name":"compression.type","value":"producer"}]}' | jq
```

### `GET /api/kafka/topics/{topic}` — Topic metadata

```bash
curl -s http://localhost:3001/api/kafka/topics/orders.events | jq
```

### `DELETE /api/kafka/topics/{topic}` — Delete topic

```bash
curl -s -X DELETE http://localhost:3001/api/kafka/topics/orders.events | jq
```

## Messages

### `GET /api/kafka/topics/{topic}/messages?limit=20&timeoutMs=2000` — Peek (ephemeral consumer)

```bash
curl -s "http://localhost:3001/api/kafka/topics/orders.events/messages?limit=20&timeoutMs=2000" | jq
```

### `POST /api/kafka/topics/{topic}/produce` — Single message

```bash
curl -s -X POST http://localhost:3001/api/kafka/topics/orders.events/produce \
  -H 'Content-Type: application/json' \
  -d '{"key":"o-001","value":{"orderId":"o-001","amount":120},"headers":{"source":"api"}}' | jq
```

### `POST /api/kafka/topics/{topic}/produce-batch` — Batch messages

```bash
curl -s -X POST http://localhost:3001/api/kafka/topics/orders.events/produce-batch \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"key":"o-001","value":{"amount":120}},{"key":"o-002","value":{"amount":350}}]}' | jq
```

## Consumer groups

### `GET /api/kafka/consumer-groups`

```bash
curl -s "http://localhost:3001/api/kafka/consumer-groups?limit=50" | jq
```

### `GET /api/kafka/consumer-groups/{groupId}` — Group detail + member lag

```bash
curl -s http://localhost:3001/api/kafka/consumer-groups/orders-consumer | jq
```

### `DELETE /api/kafka/consumer-groups/{groupId}` — Delete group offset

```bash
curl -s -X DELETE http://localhost:3001/api/kafka/consumer-groups/orders-consumer | jq
```

### `GET /api/kafka/consumer-groups/{groupId}/lag?topic=orders.events`

```bash
curl -s "http://localhost:3001/api/kafka/consumer-groups/orders-consumer/lag?topic=orders.events" | jq
```

### `POST /api/kafka/consumer-groups/{groupId}/reset-offset`

```bash
curl -s -X POST http://localhost:3001/api/kafka/consumer-groups/orders-consumer/reset-offset \
  -H 'Content-Type: application/json' \
  -d '{"topic":"orders.events","partitions":{"0":"earliest","1":"earliest"},"strategy":"earliest"}' | jq
```

## Cluster & stats

### `GET /api/kafka/cluster`

```bash
curl -s http://localhost:3001/api/kafka/cluster | jq
```

### `GET /api/kafka/stats`

```bash
curl -s http://localhost:3001/api/kafka/stats | jq
```