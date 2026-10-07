# Kafka Topics & Event Contracts

The platform uses **Redpanda** (Kafka API compatible) as the streaming backbone.

## Topics

| Topic | Producer | Consumer | Partitions | Retention |
| --- | --- | --- | --- | --- |
| `crawler.tiki.products` | `crawler-tiki` | `bronze-streaming` | 6 | 7d |
| `crawler.github.events` | `crawler-github` | `bronze-streaming` | 3 | 3d |
| `crawler.crypto.prices` | `crawler-crypto` | `bronze-streaming` | 3 | 1d |
| `crawler.weather.readings` | `crawler-weather` | `bronze-streaming` | 3 | 1d |
| `clickstream.events` | Web SDK | `bronze-streaming` | 12 | 7d |
| `ecommerce.orders` | Order Service | `bronze-streaming` | 6 | 30d |
| `ecommerce.payments` | Payment Service | `bronze-streaming` | 6 | 30d |

## Event Schemas (JSON)

### `crawler.tiki.products`

```json
{
  "event_id": "uuid-v4",
  "event_time": "2026-01-15T10:23:45.123Z",
  "source": "tiki",
  "category": "electronics",
  "url": "https://tiki.vn/...",
  "payload": {
    "title": "...",
    "price": 1230000,
    "sku": "...",
    "images": ["..."]
  }
}
```

### `clickstream.events`

```json
{
  "event_id": "uuid-v4",
  "event_time": "2026-01-15T10:23:45.123Z",
  "user_id": "anon-uuid",
  "session_id": "...",
  "page": "/product/123",
  "referrer": "google.com",
  "ua": "Mozilla/5.0 ..."
}
```

### `ecommerce.orders`

```json
{
  "event_id": "uuid-v4",
  "event_time": "2026-01-15T10:23:45.123Z",
  "order_id": "ORD-...",
  "customer_id": "CUS-...",
  "total": 2500000,
  "currency": "VND",
  "items": [
    { "sku": "...", "qty": 2, "price": 1250000 }
  ]
}
```

## Consumer Groups

| Group ID | Subscribed Topics | Purpose |
| --- | --- | --- |
| `bronze-streaming` | all crawler topics, clickstream, ecommerce | Write to `s3a://lake/bronze/stream/<topic>/` |
| `gold-aggregator` | `ecommerce.orders` | Real-time `agg_category_revenue` |
| `dlq-writer` | all topics (DLQ mirror) | Persist poison messages |

## Topic Configuration Defaults

- `cleanup.policy = delete`
- `compression.type = producer`
- `min.insync.replicas = 1` (local dev) / `2` (prod)
- `acks = all`
