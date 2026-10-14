# Data Lakehouse — Architecture & Data Flow

> **Mục đích:** Giải thích kiến trúc tổng thể, luồng dữ liệu, và cách từng layer tương tác.
> Stack: **Apache Spark 3.5** (batch + structured streaming) + **Delta Lake** + **MinIO** (S3) + **Redpanda/Kafka** + **Airflow** + **Next.js API** + **React Web UI**

---

## High-level diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                       EXTERNAL SOURCES                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐│
│  │ Tiki.vn  │  │ GitHub   │  │ CoinGecko│  │ OpenWx   │  │ Mock gen ││
│  │ (HTML)   │  │ (REST)   │  │ (REST)   │  │ (REST)   │  │ (CSV/JSON)│
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘│
└───────┼─────────────┼─────────────┼─────────────┼─────────────┼──────┘
        │             │             │             │             │
        │  crawlers/  │             │             │             │  mock/
        │  tiki_      │             │             │             │  retail_*
        │  crawler.py │             │             │             │  generator.py
        ▼             ▼             ▼             ▼             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       INGESTION LAYER                                 │
│  ┌─────────────────────────────┐  ┌──────────────────────────────┐  │
│  │  BATCH (CSV/JSON)           │  │  STREAMING (Kafka producers) │  │
│  │  • csv_ingestor.py          │  │  • clickstream_producer.py   │  │
│  │  • json_ingestor.py         │  │  • crawlers → kafka topics   │  │
│  │  • path: data-samples/      │  │  • partitions: 3 per topic  │  │
│  └────────────┬────────────────┘  └──────────────┬───────────────┘  │
└───────────────┼─────────────────────────────────┼────────────────────┘
                │                                 │
                ▼                                 ▼
        ┌──────────────────┐         ┌─────────────────────────┐
        │  s3a://bronze/   │◄────────┤  Kafka topics           │
        │  (raw, append)   │         │  (clickstream-events,   │
        │  • CRM/*.csv     │         │   ecommerce-*, crypto,  │
        │  • ERP/*.json    │         │   github, weather, hn)  │
        │  • clickstream/  │         └─────────────────────────┘
        │  • ecommerce/    │
        └────────┬─────────┘
                 │
                 │  Spark Structured Streaming
                 │  (auto loader via readStream)
                 │
                 ▼
        ┌──────────────────────────────────────────────────┐
        │  s3a://silver/                                  │
        │  (cleaned, schema-enforced, deduped)            │
        │  • crm/customers  (typed, email validation)     │
        │  • erp/products   (typed, deduplicated by id)  │
        │  • erp/orders     (typed, parsed timestamps)   │
        │  • clickstream/   (sessionized)                │
        │  • ecommerce/     (joined products+reviews)    │
        └────────┬─────────────────────────────────────────┘
                 │
                 │  Batch aggregation (groupBy, window, join)
                 │
                 ▼
        ┌──────────────────────────────────────────────────┐
        │  s3a://gold/                                    │
        │  (business-level, denormalized, queryable)      │
        │  • dim_customers  (SCD2-ish)                    │
        │  • dim_products   (latest product master)       │
        │  • fact_orders    (enriched order line items)   │
        │  • daily_revenue  (rolling 7d, 30d)             │
        └────────┬─────────────────────────────────────────┘
                 │
                 │  DuckDB / Spark SQL query
                 │
        ┌────────▼─────────────────────────────────────────┐
        │  API Layer (Next.js + DuckDB)                    │
        │  • /api/datasets?layer=gold                      │
        │  • /api/query/sql?q=SELECT ...                   │
        │  • /api/pipeline/run/{name}                      │
        └────────┬─────────────────────────────────────────┘
                 │
                 ▼
        ┌──────────────────────────────────────────────────┐
        │  Web UI (React + Vite)                          │
        │  • Dataset browser (MinIO)                      │
        │  • SQL query editor                             │
        │  • Pipeline run monitor (BullMQ + WebSocket)    │
        │  • Schema viewer                                │
        └──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                       ORCHESTRATION                                  │
│  Airflow 2.7 (PostgreSQL executor)                                   │
│  • retail_elt_dag       (daily)   → batch_retail.py                 │
│  • clickstream_stream   (hourly)  → stream_clickstream.py            │
│  • ecommerce_stream     (hourly)  → stream_ecommerce.py              │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Layer-by-layer contract

### Bronze (raw, append-only)

**Purpose:** Persist raw data as ingested, no transformation. Acts as audit log + replay source.

| Property          | Value                                                      |
| ----------------- | ---------------------------------------------------------- |
| Format            | Delta Lake                                                  |
| Partitioning      | `processing_date=YYYY-MM-DD` (default)                      |
| Write mode        | `append` only                                              |
| Schema            | Inferred (schema-on-read)                                  |
| Retention         | Forever (purge via lifecycle later)                        |
| Typical size      | GB/day (mock: MB/day)                                      |

**Files:**
- `csv_ingestor.py` — reads `data-samples/<source>/**/*.csv` → `s3a://bronze/<source>/`
- `json_ingestor.py` — same for `*.json` (newline-delimited)
- `stream_clickstream.py` — `readStream` from `clickstream-events` → `s3a://bronze/clickstream/`
- `stream_ecommerce.py` — `readStream` from 3 ecommerce topics → `s3a://bronze/ecommerce/`

### Silver (cleaned, typed, deduped)

**Purpose:** Schema enforcement, type coercion, deduplication, null handling, business rules.

| Property          | Value                                                      |
| ----------------- | ---------------------------------------------------------- |
| Format            | Delta Lake                                                  |
| Partitioning      | `processing_date=YYYY-MM-DD` + `source`                    |
| Write mode        | `merge` (upsert by primary key)                            |
| Schema            | Explicit, enforced via Delta schema check                 |
| Dedup key         | `id` (CRM) / `order_id+line_item_id` (orders) / `event_id` (stream) |
| Retention         | 90 days (configurable)                                     |

**Transformers:**
- `customers_transformer.py` — email validation, phone normalization, dedup by `customer_id`
- `products_transformer.py` — price to decimal, category normalization, dedup by `product_id`
- `orders_transformer.py` — timestamp parsing, status enum, line item flatten, dedup by `order_id+sku`
- `stream_clickstream.py` (silver stage) — sessionize (30-min window), parse user_agent
- `stream_ecommerce.py` (silver stage) — join products+reviews on `product_id`, dedup

### Gold (business, aggregated)

**Purpose:** Denormalized tables for BI/API consumption. Pre-aggregated for fast queries.

| Property          | Value                                                      |
| ----------------- | ---------------------------------------------------------- |
| Format            | Delta Lake                                                  |
| Partitioning      | `processing_date=YYYY-MM-DD` (fact_orders) / by year-month (dims) |
| Write mode        | `overwrite` partition (idempotent)                        |
| Schema            | Star schema (1 fact + N dims)                             |
| Refresh           | Daily batch (DAG-driven)                                   |
| Consumers         | Metabase, Next.js API (DuckDB), ad-hoc Spark SQL          |

**Tables:**
- `dim_customers` — SCD2: `customer_id, valid_from, valid_to, is_current, ...`
- `dim_products` — latest product master: `product_id, name, category, price, ...`
- `fact_orders` — order line items with FK to dims + measures: `quantity, revenue, discount, ...`
- `daily_revenue` — `date, total_revenue, order_count, customer_count, top_category`

---

## Component responsibilities

| Component            | Tech              | Responsibility                                          |
| -------------------- | ----------------- | ------------------------------------------------------- |
| **MinIO**            | S3-compatible     | Object store cho Delta tables + landing zone            |
| **Hive Metastore**   | Thrift + Postgres | Catalog Delta tables (tên, schema, partition, location) |
| **Spark Master/Worker** | Spark 3.5       | Chạy batch + streaming jobs (Delta reader/writer)       |
| **Kafka/Redpanda**   | Kafka protocol    | Streaming ingestion bus (producers/crawlers → consumers) |
| **Airflow**          | Python DAGs       | Schedule & monitor pipeline runs (retries, alerting)    |
| **MongoDB**          | Document          | App metadata: users, jobs history, dataset config       |
| **Redis**            | Cache + queue     | BullMQ queues cho async jobs, session cache             |
| **Metabase**         | BI                | SQL dashboards trực tiếp trên MinIO/Delta              |
| **Next.js API**      | TypeScript        | REST endpoints, DuckDB query engine, job orchestration  |
| **React Web**        | Vite + TypeScript | Frontend: dataset browser, SQL editor, job monitor      |

---

## Data flow examples

### Example 1: Batch retail (CRM + ERP)

```
1. Data scientists drop files:
   data-samples/crm/customers.csv      (10k rows)
   data-samples/erp/products.csv        (5k rows)
   data-samples/erp/orders.json         (50k rows, NDJSON)

2. Airflow triggers (daily @02:00):
   retail_elt_dag → runs batch_retail.py via spark-submit

3. Bronze ingest (csv_ingestor, json_ingestor):
   s3a://bronze/crm/customers/processing_date=2026-10-13/*.parquet
   s3a://bronze/erp/products/processing_date=2026-10-13/*.parquet
   s3a://bronze/erp/orders/processing_date=2026-10-13/*.parquet

4. Silver transform (customers/products/orders_transformer):
   s3a://silver/crm/customers/processing_date=2026-10-13/*.parquet
   s3a://silver/erp/products/processing_date=2026-10-13/*.parquet
   s3a://silver/erp/orders/processing_date=2026-10-13/*.parquet
   (merge by primary key, dedup, type coerce, validate)

5. Gold aggregate (fact_orders + 3 dims):
   s3a://gold/dim_customers/processing_date=2026-10-13/*.parquet
   s3a://gold/dim_products/processing_date=2026-10-13/*.parquet
   s3a://gold/fact_orders/processing_date=2026-10-13/*.parquet
   s3a://gold/daily_revenue/processing_date=2026-10-13/*.parquet

6. API + UI refresh:
   - Metabase: auto-refresh dashboard trên fact_orders
   - API: GET /api/datasets?layer=gold → returns new tables
   - Web UI: "Gold" tab shows new tables with row counts
```

### Example 2: Clickstream streaming

```
1. Producer loop (clickstream_producer.py):
   kafka-console-producer → clickstream-events (3 partitions)
   {
     "user_id": "u_123",
     "event_type": "page_view",
     "url": "/products/abc",
     "timestamp": "2026-10-13T03:14:15Z",
     "session_id": "s_456"
   }

2. Spark Structured Streaming (readStream):
   Bronze: s3a://bronze/clickstream/processing_date=2026-10-13/.../*.parquet
   (micro-batch every 30s, checkpoint at s3a://bronze/_checkpoints/clickstream)

3. Silver (sessionization in stream):
   s3a://silver/clickstream/sessions/processing_date=2026-10-13/.../*.parquet
   (group by session_id, window of 30 min, count page_views, last_url)

4. Gold (aggregations):
   s3a://gold/clickstream_daily_users/processing_date=2026-10-13/.../*.parquet
   (DAU, page_view per user, top URLs)

5. Real-time UI:
   - WebSocket pushes new events to Web UI "Live" tab
   - Chart auto-updates every 5s
```

---

## Phi tiết kỹ thuật

### Delta Lake transaction log

Mỗi Delta table có `_delta_log/` chứa:
- `00000000000000000000.json` — initial schema + metadata
- `00000000000000000001.json` — add/remove files, schema evolution
- `00000000000000000010.checkpoint.parquet` — checkpoint mỗi 10 commits

→ Đảm bảo **ACID**, **time travel** (`RESTORE TO VERSION AS OF 5`), và **schema enforcement**.

### Streaming checkpoint

```
s3a://bronze/_checkpoints/
  ├─ clickstream/      ← Structured Streaming offset
  ├─ ecommerce/
  └─ ...

# Xoá để replay từ đầu:
aws s3 rm s3://bronze/_checkpoints/clickstream/ --recursive
```

### Spark config (configs/spark-defaults.conf)

```
spark.sql.extensions              io.delta.sql.DeltaSparkSessionExtension
spark.sql.catalog.spark_catalog   org.apache.spark.sql.delta.catalog.DeltaCatalog
spark.databricks.delta.schema.autoMerge.enabled  true    # tự động thêm cột mới
spark.databricks.delta.enableDeletionVectors      true    # DELETE tối ưu

# MinIO S3A
spark.hadoop.fs.s3a.endpoint      http://minio:9000
spark.hadoop.fs.s3a.access.key    minioadmin
spark.hadoop.fs.s3a.path.style.access  true
```

---

## Tham khảo thêm

- [DEV_LINKS.md](./DEV_LINKS.md) — Tất cả URL truy cập
- [DATA_LAYOUT.md](./DATA_LAYOUT.md) — Schema chi tiết từng table
- [../api/ARCHITECTURE.md](../api/ARCHITECTURE.md) — API & Web app architecture
- [../plan/](../plan/) — Roadmap & design docs
