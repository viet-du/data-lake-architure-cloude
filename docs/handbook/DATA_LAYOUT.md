# 📊 Data Layout — Schemas & Queries

> **Mục đích:** Tra cứu schema, sample data, và câu query mẫu cho mỗi table.
> **Source of truth:** Bảng dưới được generate tự động từ `workspace.information_schema.columns` — luôn khớp với production.

---

## 🗺️ Map toàn bộ data flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  🥉 BRONZE (raw, 1:1 với CSV trong Volume)                          │
│  workspace.bronze.customers_test        10 rows  ← input CSV         │
│  workspace.bronze.orders_test           17 rows  ← input CSV         │
└────────────────────┬────────────────────────────────────────────────┘
                     │ ETL: pandas transform         ELT: SQL transform
                     ▼                               ▼
┌─────────────────────────────────────┐  ┌─────────────────────────────┐
│  📥 RAW_ELT (verbatim landing,      │  │  🥈 SILVER (cleaned)         │
│  chỉ có ở ELT)                      │  │  customers_clean_etl/elt    │
│  workspace.raw_elt.customers_raw    │─▶│  orders_enriched_etl/elt    │
│  workspace.raw_elt.orders_raw       │  │                              │
└─────────────────────────────────────┘  └────────────┬────────────────┘
                                                     │
                                                     ▼
                                       ┌─────────────────────────────┐
                                       │  🥇 GOLD (LTV KPI)           │
                                       │  customer_ltv_etl            │
                                       │  customer_ltv_elt            │
                                       └─────────────────────────────┘
```

---

## 🥉 Bronze layer — raw input

**Source:** CSV files in Unity Volume `/Volumes/workspace/bronze/bronze_data/`

### `workspace.bronze.customers_test` (10 rows)

| Column | Type | Example | Notes |
|---|---|---|---|
| `customer_id` | INT | 1, 2, 3 | Primary key |
| `first_name` | STRING | "Alice", "Bob" | Trim, case preserved |
| `last_name` | STRING | "Wong", "Tran" | |
| `email` | STRING | "alice@example.com" | Validated to contain `@` |
| `age` | INT | 18-55 | All ages valid (no NULLs) |
| `_rescued_data` | STRING | NULL | Auto-added by `read_files` for malformed rows |

**Sample (3 rows):**
```
customer_id | first_name | last_name | email                | age | _rescued_data
1           | Alice      | Wong      | alice@example.com    | 30  | NULL
3           | Carol      | Le        | carol@hello.io       | 42  | NULL
5           | Eve        | Pham      | eve+work@company.com | 55  | NULL
```

### `workspace.bronze.orders_test` (17 rows)

| Column | Type | Example | Notes |
|---|---|---|---|
| `order_id` | INT | 1001-1017 | Primary key |
| `customer_id` | INT | 1-10 | FK to `customers_test` |
| `line_total` | DOUBLE | 45.00 - 12000.00 | Amount in USD |
| `status` | STRING | "completed", "pending", "cancelled" | |
| `order_date` | DATE | 2026-09-28 → 2026-10-15 | |
| `_rescued_data` | STRING | NULL | |

**Sample (3 rows):**
```
order_id | customer_id | line_total | status     | order_date  | _rescued_data
1001     | 1           | 250.00     | completed  | 2026-10-01  | NULL
1006     | 3           | 12000.00   | completed  | 2026-09-28  | NULL
1008     | 4           | 75.00      | cancelled  | 2026-10-04  | NULL
```

---

## 📥 raw_elt layer — verbatim landing (ELT only)

**Source:** `read_files('/Volumes/workspace/bronze/bronze_data/*.csv')` then `CREATE OR REPLACE TABLE`.

### `workspace.raw_elt.customers_raw` (10 rows)

Same columns as bronze + 2 audit fields:
- `_source_file` (STRING) — full path to the CSV that produced this row
- `_loaded_at` (TIMESTAMP) — server time when the table was created

### `workspace.raw_elt.orders_raw` (17 rows)

Same columns as bronze + 2 audit fields (above).

> **Lưu ý:** raw_elt là bản copy nguyên vẹn của CSV. Nếu CSV thay đổi, ELT pipeline sẽ tạo raw_elt mới (overwrite). Dùng để debug "data gốc là gì".

---

## 🥈 Silver layer — cleaned, joined

**Source:** Bronze (ETL) hoặc raw_elt (ELT), transformed bằng pandas/SQL.

### `workspace.silver.customers_clean_etl` (10 rows)
### `workspace.silver.customers_clean_elt` (10 rows)

| Column | Type | Example | Transform |
|---|---|---|---|
| `customer_id` | INT | 1 | Cast to INT, dedup on customer_id (keep first) |
| `first_name` | STRING | "Alice" | TRIM, case preserved |
| `last_name` | STRING | "Wong" | TRIM |
| `email` | STRING | "alice@example.com" | LOWER + TRIM, drop if no `@` |
| `age` | INT | 30 | Cast to INT |
| `_ingested_at` | TIMESTAMP | 2026-10-19 11:31:00 | Audit (server time) |

### `workspace.silver.orders_enriched_etl` (17 rows)
### `workspace.silver.orders_enriched_elt` (17 rows)

| Column | Type | Example | Transform |
|---|---|---|---|
| `order_id` | INT | 1001 | |
| `customer_id` | INT | 1 | FK to `customers_clean_*` |
| `customer_name` | STRING | "Alice Wong" | JOIN with customers: first_name + ' ' + last_name |
| `line_total` | DOUBLE | 250.00 | |
| `status` | STRING | "completed" | |
| `order_date` | DATE | 2026-10-01 | |
| `is_high_value` | BOOLEAN | false | Computed: `line_total >= 1000` |

> **ETL và ELT silver tables có data GIỐNG NHAU** (verified 2026-10-19, 17 rows match).

---

## 🥇 Gold layer — LTV (Lifetime Value)

**Source:** Silver layer, aggregated.

### `workspace.gold.customer_ltv_etl` (10 rows)
### `workspace.gold.customer_ltv_elt` (10 rows)

| Column | Type (ETL) | Type (ELT) | Example | Notes |
|---|---|---|---|---|
| `customer_id` | INT | INT | 3 | |
| `customer_name` | STRING | STRING | "Carol Le" | |
| `email` | (not in ETL) | STRING | "carol@hello.io" | ELT có thêm, ETL thì không |
| `total_orders` | INT | LONG | 2 | COUNT(order_id) |
| `lifetime_value` | **DECIMAL** | **DOUBLE** | 17500.00 | SUM(line_total) |
| `last_order_date` | **STRING** | **DATE** | "2026-10-05" | MAX(order_date) |
| `has_high_value_order` | BOOLEAN | BOOLEAN | true | Có order ≥ $1000? |

> ⚠️ **Type drift:** Một số cột ETL/ELT có kiểu khác nhau. Frontend nên cast khi so sánh, hoặc dùng `CAST(... AS STRING)`.

**Sample top-3 by LTV:**
```
customer_id | customer_name | total_orders | lifetime_value | has_high_value_order
3           | Carol Le      | 2            | 17500.00       | true
8           | Henry Ly      | 2            |  7700.00       | true
2           | Bob Tran      | 2            |  3289.99       | true
```

---

## 📝 Useful queries

### 1. Top 10 customers by LTV
```sql
SELECT customer_id, customer_name, total_orders, lifetime_value
FROM workspace.gold.customer_ltv_etl
ORDER BY CAST(lifetime_value AS DOUBLE) DESC
LIMIT 10;
```

### 2. High-value customers (LTV > 1000) with their high-value orders
```sql
SELECT
  c.customer_id,
  c.customer_name,
  CAST(c.lifetime_value AS DOUBLE) AS ltv,
  c.total_orders,
  c.has_high_value_order,
  COUNT(o.order_id) AS high_value_order_count
FROM workspace.gold.customer_ltv_etl c
JOIN workspace.silver.orders_enriched_etl o
  ON c.customer_id = o.customer_id AND o.is_high_value = true
WHERE CAST(c.lifetime_value AS DOUBLE) > 1000
GROUP BY c.customer_id, c.customer_name, c.lifetime_value, c.total_orders, c.has_high_value_order
ORDER BY ltv DESC;
```

### 3. Daily revenue (for line chart)
```sql
SELECT
  order_date,
  COUNT(DISTINCT order_id) AS order_count,
  SUM(line_total) AS daily_revenue
FROM workspace.silver.orders_enriched_etl
WHERE status = 'completed'
GROUP BY order_date
ORDER BY order_date;
```

### 4. Customer cohort: who ordered in last 7 days
```sql
SELECT
  c.customer_id,
  c.customer_name,
  c.email,
  MAX(o.order_date) AS last_order
FROM workspace.silver.customers_clean_etl c
JOIN workspace.silver.orders_enriched_etl o
  ON c.customer_id = o.customer_id
WHERE o.status = 'completed'
  AND o.order_date >= DATE_SUB(CURRENT_DATE(), 7)
GROUP BY c.customer_id, c.customer_name, c.email
ORDER BY last_order DESC;
```

### 5. Order status distribution
```sql
SELECT
  status,
  COUNT(*) AS n,
  ROUND(AVG(line_total), 2) AS avg_amount
FROM workspace.silver.orders_enriched_etl
GROUP BY status
ORDER BY n DESC;
```

### 6. ETL vs ELT parity check
```sql
SELECT
  (SELECT COUNT(*) FROM workspace.gold.customer_ltv_etl) AS etl_count,
  (SELECT COUNT(*) FROM workspace.gold.customer_ltv_elt) AS elt_count,
  (SELECT COUNT(*) FROM workspace.gold.customer_ltv_etl) =
  (SELECT COUNT(*) FROM workspace.gold.customer_ltv_elt) AS row_counts_match;
```

---

## 🔧 Ad-hoc: refresh schema doc

Schema ở trên khớp với Databricks. Để re-generate sau khi table thay đổi:

```bash
python scripts/_sql_query.py "
  SELECT table_schema, table_name, column_name, data_type
  FROM workspace.information_schema.columns
  WHERE table_catalog = 'workspace'
    AND table_schema IN ('bronze', 'silver', 'gold', 'raw_elt')
  ORDER BY table_schema, table_name, ordinal_position
"
```

---

## ⚠️ Edge cases / gotchas

| Gotcha | Why | Workaround |
|---|---|---|
| `lifetime_value` is `DECIMAL` in ETL, `DOUBLE` in ELT | pandas default vs SQL warehouse default | `CAST(... AS DOUBLE)` in queries |
| `last_order_date` is `STRING` in ETL | pandas doesn't auto-cast dates | `CAST(... AS DATE)` |
| ELT has `email` column, ETL doesn't | ETL script doesn't pass it through | Pick `_elt` if you need email in gold |
| Bronze has `_rescued_data` column | Auto-added by `read_files` for malformed rows | Ignore in app logic |
| No partitioning | Dataset is tiny (10/17 rows) | Re-evaluate when data grows to >100k rows |
| No history retention on raw_elt | `CREATE OR REPLACE TABLE` overwrites | Use `MERGE INTO` for incremental, or save snapshots to Volume |

---

## 📊 Data quality

| Check | Result | Date verified |
|---|---|---|
| Bronze = CSV row count | 10/10 customers, 17/17 orders | 2026-10-19 |
| Silver dedup | 0 duplicates | 2026-10-19 |
| Gold row count = Silver distinct customers | 10/10 | 2026-10-19 |
| All emails have `@` after Silver | 10/10 valid | 2026-10-19 |
| ETL output ≡ ELT output | Row count + LTV top-3 match | 2026-10-19 |
