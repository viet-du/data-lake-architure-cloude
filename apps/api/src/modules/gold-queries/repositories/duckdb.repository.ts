import { readFile } from 'fs/promises';
import { join } from 'path';
import { getDuckDB } from '@/lib/infra/duckdb';
import { wrapWithRowLimit } from './sql-guard';
import type { QueryFile, QueryResult } from '../types';

const SQL_DIR = join(process.cwd(), 'src', 'modules', 'gold-queries', 'sql');

export const QUERY_FILES: QueryFile[] = [
  {
    id: 'business-metrics',
    name: 'Business Metrics',
    description: 'Top metrics for BI dashboard (revenue trend, top customers, revenue by city, top products)',
    file: '01_business_metrics.sql',
  },
  {
    id: 'customer-analytics',
    name: 'Customer Analytics',
    description: 'RFM segmentation + cohort analysis + top customers per city',
    file: '02_customer_analytics.sql',
  },
  {
    id: 'product-performance',
    name: 'Product Performance',
    description: 'Category performance + best sellers + slow movers + MoM growth',
    file: '03_product_performance.sql',
  },
  {
    id: 'category-revenue',
    name: 'Category Revenue',
    description: 'Top parent categories + revenue by category + market share + growth rate',
    file: '04_category_revenue.sql',
  },
];

export const GoldQueriesDuckDBRepository = {
  async ensureConnection(): Promise<void> {
    await getDuckDB();
  },

  async runQuery(sql: string, limit: number): Promise<QueryResult> {
    const start = Date.now();
    await this.ensureConnection();
    const instance = await getDuckDB();
    const conn = await instance.connect();
    const finalSql = wrapWithRowLimit(sql, limit);
    const res = await conn.runAndReadAll(finalSql);
    const rows = res.getRowObjects() as Array<Record<string, unknown>>;
    const columns = res.columnNames();
    return {
      query: finalSql,
      rowCount: rows.length,
      rows,
      columns,
      durationMs: Date.now() - start,
    };
  },

  async loadSqlFile(name: string): Promise<string> {
    const file = QUERY_FILES.find((f) => f.id === name);
    if (!file) throw new Error(`Unknown query file: ${name}`);
    const path = join(SQL_DIR, file.file);
    return readFile(path, 'utf-8');
  },

  async runBusinessMetrics(days: number, limit: number): Promise<QueryResult> {
    const sql = await this.loadSqlFile('business-metrics');
    return this.runQuery(sql, limit);
  },

  async runCustomerAnalytics(segment: string, limit: number): Promise<QueryResult> {
    const sql = await this.loadSqlFile('customer-analytics');
    if (segment !== 'all') {
      const filtered = sql.replace(/ORDER BY lifetime_revenue DESC\nLIMIT \d+;?$/i, '') +
        ` WHERE rfm_segment = '${segment}'\nORDER BY lifetime_revenue DESC\nLIMIT ${limit};`;
      return this.runQuery(filtered, limit);
    }
    return this.runQuery(sql, limit);
  },

  async runProductPerformance(category: string | undefined, days: number, limit: number): Promise<QueryResult> {
    const sql = await this.loadSqlFile('product-performance');
    let modified = sql;
    if (category) {
      modified = modified.replace(/GROUP BY category, subcategory/i, `WHERE category = '${category}' GROUP BY category, subcategory`);
    }
    return this.runQuery(modified, limit);
  },

  async runCategoryRevenue(parentCategory: string | undefined, limit: number): Promise<QueryResult> {
    const sql = await this.loadSqlFile('category-revenue');
    let modified = sql;
    if (parentCategory) {
      modified = modified.replace(/ORDER BY p\.total_revenue DESC\nLIMIT \d+;?$/i,
        `WHERE p.parent_category = '${parentCategory}'\nORDER BY p.total_revenue DESC\nLIMIT ${limit};`);
    }
    return this.runQuery(modified, limit);
  },
};

export { SQL_DIR };