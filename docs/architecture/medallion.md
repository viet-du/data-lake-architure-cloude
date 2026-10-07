# Medallion Architecture (Bronze / Silver / Gold)

The data lake follows the **Medallion** pattern with three concentric layers.

## Bronze — Raw zone

- **Purpose**: Immutable, append-only landing area.
- **Format**: Delta Lake on MinIO (`s3a://lake/bronze/...`).
- **Schema**: Event-time column + raw payload + ingest metadata.
- **Quality**: No cleaning. Failures are quarantined to `bronze/_dlq/`.
- **Sources**:
  - Crawlers (Tiki, GitHub, Crypto, Weather) → Kafka → Spark Streaming
  - Batch ingestion (`lakehouse.batch.ingest`) from CSV/JSON/Parquet
  - Synthetic mock data (retail generator)

## Silver — Cleansed zone

- **Purpose**: Conformed, deduplicated, schema-validated.
- **Format**: Delta Lake with enforced schema, primary keys, and DQ checks.
- **Transforms**:
  - Type coercion + null handling
  - Deduplication (event_id + window)
  - Late-arrival handling (watermarks)
  - PII masking (configurable)
- **Consumers**: Downstream Gold aggregations, ad-hoc analytics, ML feature stores.

## Gold — Curated zone

- **Purpose**: Business-facing KPIs, dimensions, facts.
- **Format**: Delta Lake, partitioned for BI query patterns.
- **Models**:
  - **Facts**: `fact_orders`, `fact_clicks`, `fact_payments`
  - **Dimensions**: `dim_customer`, `dim_product`, `dim_date`
  - **Aggregates**: `agg_daily_revenue`, `agg_category_revenue`, `agg_funnel`
- **Consumers**: Metabase dashboards, Trino/Presto ad-hoc, ML training sets.

## Layer Boundaries

| From → To | Mechanism | Frequency |
| --- | --- | --- |
| Crawlers → Kafka | HTTP polling | Per crawl schedule |
| Kafka → Bronze | Spark Structured Streaming | Real-time (micro-batch 30s) |
| External batch → Bronze | PySpark batch job | Hourly / on-demand |
| Bronze → Silver | PySpark batch job | Hourly + manual trigger |
| Silver → Gold | PySpark batch job | Hourly + manual trigger |
| Gold → Metabase | Hive Metastore over Trino | Real-time (query time) |

## DQ Gates

Each transition runs a DQ check:

- **Bronze → Silver**: Schema + null + duplicate
- **Silver → Gold**: Referential integrity + business rules + freshness

Failures block the downstream job and emit an Airflow alert.
