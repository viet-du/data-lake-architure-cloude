# Databricks Workspace — Live Inventory

**Date:** 2026-10-19 09:35 UTC+7
**Workspace:** `dbc-70e4e968-2b60.cloud.databricks.com` (AWS, region: us-west-2)
**User:** `duviet720@gmail.com` (admin)
**Compute:** Serverless SQL Warehouse `affdbeeaeabd36ae` (XXSMALL / 2X-Small, Photon, auto-stop 10 min)

## Status

| Component | Status |
|-----------|--------|
| Auth (host + token) | ✅ 200 OK |
| SQL warehouse | ✅ Auto-start on query |
| Unity Catalog | ✅ 4 catalogs visible |
| `workspace` catalog | ✅ Pre-provisioned schemas (bronze/silver/gold) |

## Catalogs

```
dbacademy     samples     system     workspace
```

## Schemas in `workspace`

```
bronze                  ← ready for raw data
bronze_silver_gold      ← ?
default                 ← empty
gold                    ← ready for aggregated
information_schema      ← system
silver                  ← ready for cleansed
```

## Volume `workspace.bronze.bronze_data` (MANAGED)

```
/Volumes/workspace/bronze/bronze_data/
├── crm/
│   └── customers/        ← empty (ready for production data)
├── erp/
│   └── orders/           ← empty (ready for production data)
├── customers_test.csv    ← 10 rows (smoke test)
└── orders_test.csv       ← 17 rows (smoke test)
```

## Sample data preview

**`customers_test.csv`** (10 rows):
```
customer_id  first_name  last_name  email              age
1            Alice       Wong       alice@example.com  30
2            Bob         Tran       bob@test.com       25
3            Carol       Le         carol@hello.io     42
```

**`orders_test.csv`** (17 rows):
```
order_id  customer_id  line_total  status     order_date
1001      1            250.0       completed  2026-10-01
1002      1            1200.5      completed  2026-10-03
1003      1            450.0       pending    2026-10-10
```

## What's working

| Operation | Verified |
|-----------|----------|
| Token auth (Bearer) | ✅ |
| List clusters (REST) | ✅ (empty — workspace không có cluster) |
| Create cluster | ❌ `does not have any associated worker environments` (free tier?) |
| List SQL warehouses | ✅ |
| Run SQL via warehouse | ✅ `SELECT 1` returns in ~3s |
| `SHOW CATALOGS / SCHEMAS / TABLES` | ✅ |
| `LIST /Volumes/...` | ✅ |
| `read_files()` against CSV | ✅ |

## Architecture decision

Because `clusters/create` fails on this workspace (no compute environments),
**the pipeline must use Serverless SQL Warehouse** (or `databricks-connect` once
Databricks publishes a 3.14-compatible wheel).

`src/lakehouse/core/databricks_bridge.py` now exposes:

- `run_sql(stmt, warehouse_id, catalog, schema)` — execute arbitrary SQL,
  return dict `{status, columns, rows}`. ~2-3s per query.
- `is_databricks_connect_available()` — returns `False` on Py 3.14.
- `smoke_test()` — runs `SELECT current_user()` + `SHOW CATALOGS`.

## Local CLI

```bash
# Save credentials
python scripts/_quick_config.py

# One-off SQL
python scripts/_sql_query.py "SELECT current_user(), current_database()"
python scripts/_sql_query.py "SHOW TABLES IN workspace.bronze"

# Smoke test
python -c "import sys; sys.path.insert(0,'src'); \
  from lakehouse.core.databricks_bridge import smoke_test; smoke_test()"
```

## Next steps

1. ✅ **Done:** workspace reachable, SQL warehouse operational.
2. ✅ **Done:** CSV → Bronze (2 tables, Delta).
3. ✅ **Done:** Bronze → Silver (dedup, validate, join).
4. ✅ **Done:** Silver → Gold (LTV aggregation).
5. ⏭ **TODO:** Set up DLT pipeline (bronze → silver → gold) using serverless compute.
6. ⏭ **TODO:** Connect R2 (Cloudflare) to bronze layer for raw landing zone.

## Demo pipeline output (2026-10-19 09:42 UTC+7)

Tables created via `_ingest_test.py` and `_silver_gold_test.py`:

```
workspace.bronze.customers_test    (10 rows, 6 cols)
workspace.bronze.orders_test       (17 rows, 6 cols)
workspace.silver.customers_clean   (10 rows, 6 cols, deduped + validated)
workspace.silver.orders_enriched   (17 rows, 7 cols, joined with customers)
workspace.gold.customer_ltv        (10 rows, 7 cols, aggregated)
```

Top 5 customers by LTV:

| customer_id | name        | orders | LTV      | last_order |
|-------------|-------------|--------|----------|------------|
| 3           | Carol Le    | 2      | 17,500   | 2026-10-05 |
| 8           | Henry Ly    | 2      |  7,700   | 2026-10-14 |
| 2           | Bob Tran    | 2      |  3,290   | 2026-10-15 |
| 5           | Eve Pham    | 2      |  2,300   | 2026-10-12 |
| 1           | Alice Wong  | 3      |  1,900   | 2026-10-10 |

**Insight:** Carol Le is the VIP (LTV 2.3× next customer). All top-5 have at
least one high-value order (≥ $1,000). Alice has 3 orders but low AOV — upsell
target.
