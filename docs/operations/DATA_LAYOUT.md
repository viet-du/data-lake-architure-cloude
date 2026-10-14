# Data Lakehouse — Data Layout Reference

> **Mục đích:** Tra cứu schema, partitioning, location, ownership của từng table ở mỗi layer.

---

## Bronze layer (raw, append-only)

### `s3a://bronze/crm/`

**Source:** `data-samples/crm/customers.csv`

```csv
customer_id,first_name,last_name,email,phone,city,country,created_at
C0001,Alice,Smith,alice@example.com,+84-90-1234567,HCM,VN,2024-01-15T08:30:00Z
```

| Column        | Type    | Notes                              |
| ------------- | ------- | ---------------------------------- |
| customer_id   | string  | Primary key (C0001, C0002, ...)    |
| first_name    | string  |                                    |
| last_name     | string  |                                    |
| email         | string  | Format: RFC 5322                   |
| phone         | string  | E.164 (e.g. +84-90-1234567)        |
| city          | string  |                                    |
| country       | string  | ISO 3166-1 alpha-2                 |
| created_at    | string  | ISO 8601 UTC                       |

**Owner:** `csv_ingestor.py` — chạy 1 lần per file drop, hoặc theo DAG.

### `s3a://bronze/erp/`

**Source:** `data-samples/erp/products.csv` + `data-samples/erp/orders.json`

**products.csv:**
```csv
product_id,name,category,price,stock
P001,iPhone 15,smartphone,999.00,150
```

| Column     | Type    | Notes                |
| ---------- | ------- | -------------------- |
| product_id | string  | P001, P002, ...      |
| name       | string  |                      |
| category   | string  | smartphone, laptop, ... |
| price      | double  |                      |
| stock      | int     |                      |

**orders.json** (newline-delimited):
```json
{"order_id":"O1001","customer_id":"C0001","line_items":[{"product_id":"P001","quantity":2,"unit_price":999.00}],"status":"completed","total":1998.00,"order_date":"2024-01-15T10:00:00Z"}
```

| Column        | Type    | Notes                              |
| ------------- | ------- | ---------------------------------- |
| order_id      | string  | O1001, O1002, ...                  |
| customer_id   | string  | FK to crm.customers                |
| line_items    | array   | [{product_id, quantity, unit_price}] |
| status        | string  | pending, completed, cancelled, refunded |
| total         | double  |                                    |
| order_date    | string  | ISO 8601                           |

### `s3a://bronze/clickstream/`

**Source:** Kafka topic `clickstream-events` (3 partitions)

```json
{
  "event_id": "e_uuid",
  "user_id": "u_123",
  "event_type": "page_view",
  "url": "/products/abc",
  "referrer": "https://google.com",
  "user_agent": "Mozilla/5.0...",
  "timestamp": "2026-10-13T03:14:15Z",
  "session_id": "s_456"
}
```

| Column      | Type    | Notes                                    |
| ----------- | ------- | ---------------------------------------- |
| event_id    | string  | UUID                                     |
| user_id     | string  |                                          |
| event_type  | string  | page_view, click, scroll, add_to_cart, purchase |
| url         | string  |                                          |
| referrer    | string  | nullable                                 |
| user_agent  | string  |                                          |
| timestamp   | string  | ISO 8601                                 |
| session_id  | string  |                                          |

### `s3a://bronze/ecommerce/`

**Source:** Kafka topics `ecommerce-products-stream`, `ecommerce-reviews-stream`, `ecommerce-price-stream`

```json
// ecommerce-products-stream
{"product_id":"P001","name":"iPhone 15","category":"smartphone","price":999.00,"stock":150,"source":"tiki","crawled_at":"2026-10-13T03:00:00Z"}

// ecommerce-reviews-stream
{"product_id":"P001","user_id":"u_789","rating":5,"comment":"Great!","reviewed_at":"2026-10-13T04:00:00Z"}

// ecommerce-price-stream
{"product_id":"P001","old_price":1099.00,"new_price":999.00,"changed_at":"2026-10-13T05:00:00Z"}
```

---

## Silver layer (cleaned, typed, deduped)

### `s3a://silver/crm/customers/`

**Source:** bronze/crm/customers
**Transform:** `customers_transformer.py`
**Dedup key:** `customer_id` (merge upsert)

| Column        | Type    | Transform                                  |
| ------------- | ------- | ------------------------------------------ |
| customer_id   | string  | Trim, uppercase                            |
| first_name    | string  | Trim, title case                           |
| last_name     | string  | Trim, title case                           |
| email         | string  | Lowercase, regex validation                |
| phone         | string  | E.164 normalize                            |
| city          | string  | Trim                                       |
| country       | string  | ISO 3166-1 alpha-2                         |
| created_at    | timestamp | Parsed ISO 8601                          |
| processing_date | date  | Partition key                              |
| _ingested_at  | timestamp | Audit: thời điểm silver write          |
| _source       | string  | "crm"                                      |

### `s3a://silver/erp/products/`

**Source:** bronze/erp/products
**Transform:** `products_transformer.py`
**Dedup key:** `product_id`

| Column        | Type           | Transform                    |
| ------------- | -------------- | ---------------------------- |
| product_id    | string         | Uppercase                    |
| name          | string         | Trim                         |
| category      | string         | Lowercase, snake_case        |
| price         | decimal(10,2)  | Cast from double             |
| stock         | int            |                              |
| processing_date | date         |                              |
| _ingested_at  | timestamp      |                              |

### `s3a://silver/erp/orders/`

**Source:** bronze/erp/orders
**Transform:** `orders_transformer.py`
**Dedup key:** `(order_id, product_id)` (flatten line items)

| Column        | Type           | Transform                    |
| ------------- | -------------- | ---------------------------- |
| order_id      | string         |                              |
| customer_id   | string         | FK to customers              |
| product_id    | string         | FK to products               |
| quantity      | int            |                              |
| unit_price    | decimal(10,2)  |                              |
| line_total    | decimal(10,2)  | Computed: quantity * unit_price |
| status        | string         | Enum check                   |
| order_date    | timestamp      |                              |
| processing_date | date         |                              |

### `s3a://silver/clickstream/`

**Source:** bronze/clickstream
**Transform:** Sessionization (30-min window)
**Dedup key:** `event_id`

| Column           | Type      | Transform                                |
| ---------------- | --------- | ---------------------------------------- |
| event_id         | string    |                                          |
| user_id          | string    |                                          |
| session_id       | string    |                                          |
| event_type       | string    | Enum                                     |
| url              | string    |                                          |
| timestamp        | timestamp |                                          |
| session_start    | timestamp | Computed: first event in 30-min window  |
| session_end      | timestamp | Computed: last event in session          |
| session_duration_sec | int   | Computed                                  |
| processing_date  | date      |                                          |

### `s3a://silver/ecommerce/`

**Source:** bronze/ecommerce (3 topics merged)
**Transform:** Join products + reviews on `product_id`
**Dedup key:** `(product_id, review_id?)`

| Column        | Type           | Transform                       |
| ------------- | -------------- | ------------------------------- |
| product_id    | string         |                                 |
| name          | string         |                                 |
| category      | string         |                                 |
| current_price | decimal(10,2)  | Latest from price-stream        |
| stock         | int            |                                 |
| avg_rating    | decimal(3,2)   | AVG(reviews.rating)             |
| review_count  | int            | COUNT(reviews)                  |
| source        | string         | tiki, lazada, ...               |
| last_crawled_at | timestamp   |                                 |

---

## Gold layer (business, aggregated)

### `s3a://gold/dim_customers/`

**Grain:** 1 row per customer (SCD2)

| Column           | Type      | Notes                              |
| ---------------- | --------- | ---------------------------------- |
| customer_id      | string    |                                    |
| first_name       | string    |                                    |
| last_name        | string    |                                    |
| email            | string    |                                    |
| country          | string    |                                    |
| total_orders     | int       | COUNT from fact_orders             |
| lifetime_value  | decimal   | SUM(line_total)                    |
| first_order_date | date      | MIN(order_date)                    |
| last_order_date  | date      | MAX(order_date)                    |
| valid_from       | timestamp | SCD2: version start                |
| valid_to         | timestamp | SCD2: version end (null = current)|
| is_current       | boolean   | SCD2: true for latest              |
| processing_date  | date      |                                    |

### `s3a://gold/dim_products/`

**Grain:** 1 row per product

| Column         | Type           | Notes                              |
| -------------- | -------------- | ---------------------------------- |
| product_id     | string         |                                    |
| name           | string         |                                    |
| category       | string         |                                    |
| current_price  | decimal(10,2)  |                                    |
| total_quantity_sold | int       | SUM(fact_orders.quantity)          |
| total_revenue  | decimal        | SUM(fact_orders.line_total)        |
| avg_rating     | decimal(3,2)   | from silver/ecommerce              |
| review_count   | int            |                                    |
| processing_date | date          |                                    |

### `s3a://gold/fact_orders/`

**Grain:** 1 row per order line item

| Column           | Type           | Notes                              |
| ---------------- | -------------- | ---------------------------------- |
| order_id         | string         |                                    |
| customer_id      | string         | FK to dim_customers                |
| product_id       | string         | FK to dim_products                 |
| order_date       | date           |                                    |
| quantity         | int            |                                    |
| unit_price       | decimal(10,2)  |                                    |
| line_total       | decimal(10,2)  |                                    |
| discount_amount  | decimal(10,2)  |                                    |
| net_revenue      | decimal(10,2)  | line_total - discount              |
| country          | string         | Denormalized from dim_customers    |
| category         | string         | Denormalized from dim_products     |
| processing_date  | date           |                                    |

### `s3a://gold/daily_revenue/`

**Grain:** 1 row per day

| Column           | Type           | Notes                              |
| ---------------- | -------------- | ---------------------------------- |
| date             | date           |                                    |
| total_revenue    | decimal        |                                    |
| order_count      | int            | DISTINCT order_id                  |
| line_item_count  | int            |                                    |
| customer_count   | int            | DISTINCT customer_id               |
| avg_order_value  | decimal        | total_revenue / order_count        |
| top_category     | string         | argmax(category, sum(revenue))     |
| rolling_7d_revenue  | decimal     | SUM window 7d                      |
| rolling_30d_revenue | decimal      | SUM window 30d                     |
| processing_date  | date           |                                    |

---

## Cách query data

### Q1: Tổng doanh thu 7 ngày gần nhất

```sql
SELECT SUM(net_revenue) AS revenue
FROM delta_scan('s3a://gold/fact_orders/')
WHERE order_date >= CURRENT_DATE - INTERVAL '7 days'
```

### Q2: Top 10 khách hàng theo lifetime value

```sql
SELECT customer_id, lifetime_value, total_orders
FROM delta_scan('s3a://gold/dim_customers/')
WHERE is_current = TRUE
ORDER BY lifetime_value DESC
LIMIT 10
```

### Q3: Daily active users (DAU) từ clickstream

```sql
SELECT DATE(timestamp) AS day, COUNT(DISTINCT user_id) AS dau
FROM delta_scan('s3a://silver/clickstream/')
WHERE day >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY day
ORDER BY day
```

### Q4: Top 5 sản phẩm theo rating + review count

```sql
SELECT product_id, name, avg_rating, review_count
FROM delta_scan('s3a://gold/dim_products/')
WHERE review_count >= 10
ORDER BY avg_rating DESC, review_count DESC
LIMIT 5
```

---

## Partitioning scheme

Tất cả Delta tables partition theo `processing_date=YYYY-MM-DD` (ngoại lệ: `dim_*` partition `valid_from` cho SCD2).

```
s3a://gold/fact_orders/
  processing_date=2026-10-10/
    part-00000-*.parquet
    part-00001-*.parquet
  processing_date=2026-10-11/
    part-00000-*.parquet
  ...
  _delta_log/
    00000000000000000000.json
    00000000000000000010.checkpoint.parquet
```

**Tip:** Dùng partition pruning (`WHERE processing_date >= ...`) để query nhanh hơn 10-100x.

---

## Retention

| Layer  | Retention | Cleanup                       |
| ------ | --------- | ----------------------------- |
| Bronze | 1 year    | `VACUUM` Delta + S3 lifecycle |
| Silver | 90 days   | `VACUUM` Delta                |
| Gold   | Forever   | Manual archive                |

```sql
-- Vacuum silver cũ hơn 90 ngày
VACUUM delta_scan('s3a://silver/erp/orders/') RETAIN 720 HOURS;
```
