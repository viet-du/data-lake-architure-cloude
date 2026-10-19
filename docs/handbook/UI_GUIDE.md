# 🖥️ UI Guide — Databricks Workspace

> **Mục đích:** Hướng dẫn thao tác Databricks UI để xem / query / debug data mà không cần code.

---

## 1. Đăng nhập

Mở URL trong `.env`:

```bash
echo $DATABRICKS_HOST
# https://dbc-70e4e968-2b60.cloud.databricks.com
```

Click **Sign in** → chọn Google / SSO (tuỳ workspace). Token-based login không cần thiết cho UI.

---

## 2. Layout chính

Sau khi đăng nhập, sidebar trái có:

| Icon | Tên | Dùng để |
|---|---|---|
| 📊 | **SQL Editor** | Gõ SQL, xem kết quả, export |
| 🗂️ | **Catalog** | Browse tables, volumes, schemas |
| ⚙️ | **Compute** | Xem cluster / warehouse status |
| 📓 | **Workspace** | Notebooks, repos (legacy) |
| 🔄 | **Jobs & Pipelines** | Schedule pipeline runs (chưa dùng) |
| 🧪 | **Experiments** | MLflow (chưa dùng) |

> **Frontend team thường chỉ cần SQL Editor + Catalog.**

---

## 3. Catalog Explorer (xem data)

### 3.1 Mở Catalog Explorer

**Cách 1:** Sidebar → 🗂️ **Catalog**
**Cách 2:** URL trực tiếp:
```
https://<your-workspace>.cloud.databricks.com/explore/data
```

### 3.2 Tree structure

Bạn sẽ thấy cây:

```
📁 My organization
  📁 workspace                        ← catalog (root)
    📁 bronze                          ← schema
      📋 customers_test                ← Delta table
      📋 orders_test
      💾 bronze_data                   ← Unity Volume
    📁 silver
      📋 customers_clean_etl
      📋 customers_clean_elt
      📋 orders_enriched_etl
      📋 orders_enriched_elt
    📁 gold
      📋 customer_ltv_etl
      📋 customer_ltv_elt
    📁 raw_elt
      📋 customers_raw
      📋 orders_raw
    📁 default
    📁 information_schema
    📁 system
📁 Shares received
  📁 samples
```

### 3.3 Xem data của 1 table

**Cách A (click):**
1. Click `workspace` → `gold` → `customer_ltv_etl`
2. Tab mở ra ở panel phải
3. Click tab **Sample Data** → thấy 10 rows
4. Click tab **Schema** → thấy columns + types
5. Click tab **History** → thấy các version (Delta time travel)
6. Click tab **Lineage** → thấy bảng nào derive từ bảng nào

**Cách B (preview nhanh):**
- Hover trên table name → click icon ⋯ (3 chấm) → **Preview data**

### 3.4 Xem Volume (raw CSV)

1. Catalog → `workspace` → `bronze` → **Volumes**
2. Click `bronze_data`
3. Thấy `customers_test.csv`, `orders_test.csv`
4. Click vào file → preview / download

---

## 4. SQL Editor (chạy query)

### 4.1 Mở SQL Editor

**Cách 1:** Sidebar → 📊 **SQL Editor**
**Cách 2:** URL: `/sql`

### 4.2 Chọn warehouse

Top-right corner → dropdown "Warehouse" → chọn `affdbeeaeabd36ae` (Serverless Starter Warehouse).

Nếu chưa thấy warehouse, hỏi admin hoặc tạo mới:
- Compute → Create SQL Warehouse → Name: `dev-warehouse` → Cluster size: Small → Create

### 4.3 Chạy query đầu tiên

```sql
SELECT * FROM workspace.gold.customer_ltv_etl
ORDER BY lifetime_value DESC
LIMIT 10;
```

- `Ctrl/Cmd + Enter` để chạy
- Kết quả hiện ở tab **Results** (table view) hoặc **Chart** (visualize)
- Click icon 📥 **Download** để export CSV

### 4.4 Lưu query (snippets)

- Click 💾 **Save** ở top → đặt tên (e.g. "Top LTV customers")
- Truy cập lại: SQL Editor → Saved queries (sidebar trái)

### 4.5 Query parameters (nâng cao)

```sql
SELECT * FROM workspace.gold.customer_ltv_etl
WHERE CAST(lifetime_value AS DOUBLE) > {{min_ltv}}
ORDER BY lifetime_value DESC;
```

UI sẽ hiện input box cho `min_ltv` mỗi lần chạy.

---

## 5. Tạo dashboard (cho frontend mockup)

### 5.1 Visualization trong SQL Editor

Sau khi chạy query:
1. Click tab **Chart** (bên cạnh Results)
2. Pick chart type: Bar / Line / Pie / Scatter
3. Drag columns vào X / Y
4. Click **Save to dashboard**

### 5.2 Tạo dashboard

- Sidebar → 🗂️ **Dashboards** (hoặc `+/ New → Dashboard`)
- Name: `LTV Analytics`
- Add visualization → chọn query đã save → add vào dashboard
- Pin dashboard lên home

> ⚠️ Dashboard Databricks bản Community có giới hạn. Cho production, dùng frontend custom (xem [`API.md`](./API.md)).

---

## 6. Run a job (chạy pipeline từ UI)

> Hiện tại pipeline chạy từ terminal (`bash scripts/run_all.sh`). Để schedule tự động, dùng Databricks Jobs:

1. Sidebar → 🔄 **Jobs & Pipelines**
2. Click **Create** → **Job**
3. **Task type:** Notebook (chưa có) hoặc **Python script** (qua Databricks CLI)
4. **Cluster:** chọn warehouse hoặc all-purpose cluster
5. **Schedule:** Cron (e.g. `0 2 * * *` = daily 2am)
6. Save

> **TODO** (chưa làm): tạo Databricks Asset Bundle để deploy pipeline dưới dạng job.

---

## 7. Common UI tasks

### Xem 10 rows đầu của table

```sql
SELECT * FROM workspace.silver.orders_enriched_etl LIMIT 10;
```

### Đếm rows

```sql
SELECT COUNT(*) AS n FROM workspace.gold.customer_ltv_etl;
```

### Top N

```sql
SELECT customer_id, customer_name, lifetime_value
FROM workspace.gold.customer_ltv_etl
ORDER BY CAST(lifetime_value AS DOUBLE) DESC
LIMIT 5;
```

### Check schema

```sql
DESCRIBE TABLE workspace.silver.orders_enriched_etl;
```

### Check history (time travel)

```sql
DESCRIBE HISTORY workspace.gold.customer_ltv_etl;
```

### Restore version cũ

```sql
RESTORE TABLE workspace.gold.customer_ltv_etl TO VERSION AS OF 1;
```

---

## 8. Permission errors

### ❌ "Permission denied" khi SELECT

→ Bạn không có quyền trên table. Admin grant:
```sql
GRANT SELECT ON TABLE workspace.gold.customer_ltv_etl TO `user@example.com`;
```

### ❌ "Catalog not found"

→ Bạn đang ở sai workspace. Check URL bar — phải khớp với `.env` `DATABRICKS_HOST`.

### ❌ "Warehouse not running"

→ Warehouse tự sleep khi idle 10 phút. Click vào warehouse → **Start** (mất ~30s).

### ❌ "Query timeout"

→ Default timeout 50s. Với query lớn, run lại không cần đổi gì — warehouse sẽ tự retry với cluster lớn hơn (serverless).

---

## 9. Browser DevTools shortcut (for FE dev)

Nếu bạn muốn xem Databricks UI gọi API nào:

1. Mở DevTools (F12) → tab **Network**
2. Chạy 1 query trong SQL Editor
3. Tìm request tới `/api/2.0/sql/statements/`
4. Click → tab **Payload** xem request body
5. Tab **Response** xem JSON trả về

Đây là cách API mà frontend nên gọi. Xem [`API.md`](./API.md) để biết chi tiết format.

---

## 10. Tips

| Tip | Detail |
|---|---|
| **Pin tab** | Right-click tab table → "Pin to sidebar" để quick access |
| **Dark mode** | Click avatar (top-right) → Preferences → Theme |
| **Keyboard shortcut** | `Cmd+K` mở command palette (jump to anything) |
| **Query history** | SQL Editor → tab "History" → xem 30 ngày queries |
| **Compare schemas** | Mở 2 tabs, side-by-side |
| **Export to CSV** | Query result → click 📥 → chọn format |

---

## 11. So sánh UI vs Code

| Task | UI | Code (`_sql_query.py`) |
|---|---|---|
| Xem 1 query | ✅ Click + Cmd+Enter | ✅ `python scripts/_sql_query.py "..."` |
| Schedule job | ✅ Jobs & Pipelines | ❌ (manual run) |
| Visualize | ✅ Built-in charts | ❌ (export CSV → your tool) |
| Lưu query | ✅ Saved queries | ❌ (bash history) |
| Permissions | ✅ GUI | ✅ SQL GRANT |
| Speed (1 query) | ~2s | ~2s (chỉ khác cold start) |
| Speed (100 queries) | 100× manual clicks | Loop-able |

> **Khuyến nghị:** Dùng UI cho exploration, dùng code cho repeatable work (CI, batch, scripts).
