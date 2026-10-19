# 🔌 API Guide — Consuming Data from Frontend

> **Mục đích:** Hướng dẫn cho team frontend (Vite + React / Next.js) cách gọi data từ Databricks SQL Warehouse.
> **Stack mặc định:** Databricks SQL Statement Execution API qua HTTPS (REST).

---

## 1. Kiến trúc

```
┌─────────────────┐      HTTPS         ┌──────────────────────┐
│  Vite + React   │ ─────────────────▶ │  Next.js / Express   │
│  (frontend)     │                    │  API backend         │
└─────────────────┘                    └──────────┬───────────┘
                                                  │ HTTPS
                                                  ▼
                                    ┌──────────────────────────┐
                                    │  Databricks SQL API      │
                                    │  /api/2.0/sql/statements │
                                    └──────────┬───────────────┘
                                               ▼
                                    ┌──────────────────────────┐
                                    │  Serverless Warehouse    │
                                    │  (compute)               │
                                    └──────────┬───────────────┘
                                               ▼
                                    ┌──────────────────────────┐
                                    │  Delta tables (Gold)     │
                                    │  workspace.gold.*        │
                                    └──────────────────────────┘
```

> **Lý do qua backend:** Tránh lộ Databricks token ra browser. Backend proxy forward request.

---

## 2. Backend endpoint (Next.js example)

### File: `pages/api/lakehouse/[...slug].ts`

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';

const DATABRICKS_HOST = process.env.DATABRICKS_HOST!;
const DATABRICKS_TOKEN = process.env.DATABRICKS_TOKEN!;
const WAREHOUSE_ID = process.env.DATABRICKS_WAREHOUSE_ID!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { statement, catalog = 'workspace' } = req.body;

  if (!statement || typeof statement !== 'string') {
    return res.status(400).json({ error: 'statement is required' });
  }

  // Submit statement
  const submitRes = await fetch(`${DATABRICKS_HOST}/api/2.0/sql/statements/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DATABRICKS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      statement,
      warehouse_id: WAREHOUSE_ID,
      catalog,
      wait_timeout: '30s',
      on_wait_timeout: 'CONTINUE',
    }),
  });

  const submitData = await submitRes.json();
  const statementId = submitData.statement_id;

  // Poll until done
  let result = submitData;
  while (result.status?.state === 'PENDING' || result.status?.state === 'RUNNING') {
    await new Promise(r => setTimeout(r, 500));
    const pollRes = await fetch(
      `${DATABRICKS_HOST}/api/2.0/sql/statements/${statementId}`,
      { headers: { Authorization: `Bearer ${DATABRICKS_TOKEN}` } }
    );
    result = await pollRes.json();
  }

  if (result.status?.state !== 'SUCCEEDED') {
    return res.status(500).json({ error: result.status?.error?.message ?? 'query failed' });
  }

  // Convert to row format
  const columns = result.manifest?.schema?.columns?.map((c: any) => c.name) ?? [];
  const rows = (result.result?.data_array ?? []).map((r: any[]) =>
    Object.fromEntries(columns.map((c: string, i: number) => [c, r[i]]))
  );

  return res.json({ columns, rows, row_count: rows.length });
}
```

### Usage from frontend

```typescript
// src/api/lakehouse.ts
const API_BASE = import.meta.env.VITE_API_BASE ?? '';

export interface LtvRow {
  customer_id: number;
  customer_name: string;
  total_orders: number;
  lifetime_value: number;
  last_order_date: string;
  has_high_value_order: boolean;
}

export async function fetchTopLtv(limit = 10): Promise<LtvRow[]> {
  const res = await fetch(`${API_BASE}/api/lakehouse/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      statement: `
        SELECT customer_id, customer_name, total_orders,
               lifetime_value, last_order_date, has_high_value_order
        FROM workspace.gold.customer_ltv_etl
        ORDER BY CAST(lifetime_value AS DOUBLE) DESC
        LIMIT ${limit}
      `,
      catalog: 'workspace',
    }),
  });
  if (!res.ok) throw new Error(`Query failed: ${res.statusText}`);
  const data = await res.json();
  return data.rows;
}
```

### React component

```tsx
// src/components/LtvTable.tsx
import { useEffect, useState } from 'react';
import { fetchTopLtv, LtvRow } from '../api/lakehouse';

export function LtvTable() {
  const [data, setData] = useState<LtvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTopLtv(10)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <table>
      <thead>
        <tr>
          <th>Customer</th>
          <th>Orders</th>
          <th>LTV</th>
          <th>Last order</th>
        </tr>
      </thead>
      <tbody>
        {data.map(r => (
          <tr key={r.customer_id}>
            <td>{r.customer_name}</td>
            <td>{r.total_orders}</td>
            <td>${r.lifetime_value.toLocaleString()}</td>
            <td>{r.last_order_date}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

---

## 3. Response format

### Success

```json
{
  "columns": ["customer_id", "customer_name", "lifetime_value"],
  "rows": [
    { "customer_id": 3, "customer_name": "Carol Le", "lifetime_value": "17500.00" },
    { "customer_id": 8, "customer_name": "Henry Ly", "lifetime_value": "7700.00" }
  ],
  "row_count": 2
}
```

### Error

```json
{
  "error": "PARSE_SYNTAX_ERROR: Syntax error at or near 'FORM'",
  "error_code": "BAD_REQUEST"
}
```

### Type notes

- **Numbers** in `rows` come as strings (Databricks returns them as text). Cast in JS:
  ```js
  const ltv = parseFloat(row.lifetime_value);
  ```
- **Booleans** come as `"true"` / `"false"` strings. Cast:
  ```js
  const hasHigh = row.has_high_value_order === 'true';
  ```
- **Dates** come as ISO strings (`"2026-10-15"`).
- **DECIMAL vs DOUBLE** (ETL vs ELT): both are returned as strings.

> 💡 **Tip:** Define a normalizer function:
> ```ts
> function normalizeRow(row: any): LtvRow {
>   return {
>     customer_id: parseInt(row.customer_id, 10),
>     customer_name: String(row.customer_name),
>     lifetime_value: parseFloat(row.lifetime_value),
>     last_order_date: String(row.last_order_date),
>     has_high_value_order: row.has_high_value_order === 'true',
>     total_orders: parseInt(row.total_orders, 10),
>   };
> }
> ```

---

## 4. Direct browser call (⚠️ dev only, NOT for production)

If you want to skip the backend and call Databricks from browser (e.g. for quick prototyping):

```typescript
async function queryDatabricksDirect(sql: string) {
  const res = await fetch(`https://${WORKSPACE_HOST}/api/2.0/sql/statements/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      statement: sql,
      warehouse_id: WAREHOUSE_ID,
      catalog: 'workspace',
    }),
  });
  return res.json();
}
```

**⚠️ Dangers:**
1. **Token leaks** in browser DevTools / Network tab
2. **CORS** — Databricks may block direct browser calls depending on CORS config
3. **Rate limit** — no batching, no caching

**Use only for local dev, never deploy to production.**

---

## 5. Common API patterns

### Read gold table (most common)

```sql
SELECT * FROM workspace.gold.customer_ltv_etl
ORDER BY CAST(lifetime_value AS DOUBLE) DESC
LIMIT 100
```

### Joined query (orders + customers + LTV)

```sql
SELECT
  c.customer_id,
  c.customer_name,
  c.email,
  o.order_id,
  o.line_total,
  o.status,
  o.order_date
FROM workspace.silver.orders_enriched_etl o
JOIN workspace.silver.customers_clean_etl c
  ON o.customer_id = c.customer_id
WHERE o.status = 'completed'
ORDER BY o.order_date DESC
LIMIT 50
```

### Aggregate (daily revenue)

```sql
SELECT
  order_date,
  COUNT(DISTINCT order_id) AS order_count,
  SUM(line_total) AS revenue
FROM workspace.silver.orders_enriched_etl
WHERE status = 'completed'
  AND order_date >= DATE_SUB(CURRENT_DATE(), 30)
GROUP BY order_date
ORDER BY order_date
```

### Filter by parameter

Pass user input as parameter (NEVER concatenate — SQL injection risk):

```typescript
const stmt = `
  SELECT * FROM workspace.gold.customer_ltv_etl
  WHERE CAST(lifetime_value AS DOUBLE) > ?
  ORDER BY lifetime_value DESC
  LIMIT 50
`;

// Databricks parameter syntax:
const body = {
  statement: stmt,
  parameters: [{ value: minLtv.toString(), type: "DECIMAL" }],  // not used by every endpoint
  warehouse_id: WAREHOUSE_ID,
};
```

> **⚠️ Databricks SQL API has limited support for `?` parameters.** Most teams just use template literal:
> ```js
> `WHERE CAST(lifetime_value AS DOUBLE) > ${Number(minLtv)}`
> ```
> This is safe if you `Number()` or `parseFloat()` the input first.

---

## 6. Performance tips

| Tip | Detail |
|---|---|
| **Use `_elt` tables** for new features | They leverage warehouse compute, scale better than `_etl` |
| **LIMIT your queries** | Always add `LIMIT N` unless you need full table |
| **Filter by date** | `WHERE order_date >= ...` prunes partitions (when data grows) |
| **Use `_etl` for complex transforms** | Sometimes ETL with pandas is faster than ELT with SQL |
| **Cache responses** | Add `Cache-Control: max-age=60` in Next.js API for hot data |
| **Run queries async** | Show loading state in UI, don't block render |

---

## 7. Error handling

```typescript
async function safeQuery(sql: string): Promise<{ ok: true; rows: any[] } | { ok: false; error: string }> {
  try {
    const res = await fetch('/api/lakehouse/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statement: sql }),
    });
    if (!res.ok) {
      const err = await res.json();
      return { ok: false, error: err.error ?? `HTTP ${res.status}` };
    }
    const data = await res.json();
    return { ok: true, rows: data.rows };
  } catch (e: any) {
    return { ok: false, error: e.message ?? 'unknown' };
  }
}

// Usage
const result = await safeQuery("SELECT * FROM workspace.gold.customer_ltv_etl LIMIT 10");
if (result.ok) {
  setData(result.rows);
} else {
  setError(result.error);
}
```

---

## 8. Databricks SDK (alternative to REST)

If you prefer TypeScript SDK over raw REST:

```bash
npm install @databricks/sdk
```

```typescript
import { WorkspaceClient } from '@databricks/sdk';

const ws = WorkspaceClient({
  host: process.env.DATABRICKS_HOST,
  token: process.env.DATABRICKS_TOKEN,
});

const resp = await ws.statementExecution.execute({
  warehouse_id: process.env.DATABRICKS_WAREHOUSE_ID!,
  statement: "SELECT * FROM workspace.gold.customer_ltv_etl LIMIT 10",
  catalog: 'workspace',
});

// resp.result?.data_array is the rows
```

> **Pros:** Type safety, retries built-in, less boilerplate.
> **Cons:** Bigger bundle, depends on SDK release cadence.

---

## 9. Sample queries for the FE team

Copy-paste these into your backend to test:

### Q1: Dashboard top KPIs
```sql
SELECT
  COUNT(DISTINCT customer_id) AS total_customers,
  SUM(CAST(lifetime_value AS DOUBLE)) AS total_ltv,
  AVG(CAST(lifetime_value AS DOUBLE)) AS avg_ltv,
  MAX(CAST(lifetime_value AS DOUBLE)) AS max_ltv,
  SUM(CASE WHEN has_high_value_order THEN 1 ELSE 0 END) AS high_value_customers
FROM workspace.gold.customer_ltv_etl
```

### Q2: Recent orders (last 7 days)
```sql
SELECT
  o.order_id,
  c.customer_name,
  o.line_total,
  o.status,
  o.order_date
FROM workspace.silver.orders_enriched_etl o
JOIN workspace.silver.customers_clean_etl c USING (customer_id)
WHERE o.order_date >= DATE_SUB(CURRENT_DATE(), 7)
ORDER BY o.order_date DESC
```

### Q3: Top 5 spenders
```sql
SELECT customer_id, customer_name, total_orders, lifetime_value
FROM workspace.gold.customer_ltv_etl
ORDER BY CAST(lifetime_value AS DOUBLE) DESC
LIMIT 5
```

### Q4: Order status breakdown (pie chart)
```sql
SELECT status, COUNT(*) AS n
FROM workspace.silver.orders_enriched_etl
GROUP BY status
```

### Q5: Revenue by day (line chart)
```sql
SELECT order_date, SUM(line_total) AS daily_revenue
FROM workspace.silver.orders_enriched_etl
WHERE status = 'completed'
GROUP BY order_date
ORDER BY order_date
```

---

## 10. Environment variables (frontend)

In your `frontend/.env.local`:

```bash
VITE_API_BASE=http://localhost:3000
# OR in production:
# VITE_API_BASE=https://api.your-domain.com
```

**Do NOT put Databricks credentials in the frontend env.** They belong in the backend `.env`.

---

## 11. CORS

If you call Databricks directly from the browser and get CORS errors, you need to:

1. In Databricks workspace: Admin → Workspace settings → **Developer** → enable CORS
2. Or proxy through your backend (recommended)

---

## 12. FAQ

### Q: Why can't I just SELECT directly from the gold table without any transform?
A: You can! `SELECT * FROM workspace.gold.customer_ltv_etl` works. But for performance and clarity, always specify columns and add LIMIT.

### Q: How fast is the API?
A: First query (cold start): ~5s. Subsequent: <1s. Warehouse is serverless, scales to zero when idle.

### Q: Can I do INSERT / UPDATE from the API?
A: Yes, but avoid it. UI should only read. Writes go through the pipeline scripts.

### Q: How do I know which `_etl` vs `_elt` table to use?
A: For new features, use `_elt`. We keep both only for comparison purposes. If unsure, ask the data team.

### Q: Where can I see actual API calls?
A: Open DevTools → Network → run a query in Databricks SQL Editor → look for `/api/2.0/sql/statements/`.

---

## 13. Reference

- **Databricks SQL Statement Execution API:** https://docs.databricks.com/api/workspace/statementexecution
- **@databricks/sdk (TypeScript):** https://www.npmjs.com/package/@databricks/sdk
- **Databricks workspace:** set in `.env` → `DATABRICKS_HOST`
