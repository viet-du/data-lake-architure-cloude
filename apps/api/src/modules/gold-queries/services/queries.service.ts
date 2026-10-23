import { usesDatabricks, readStatement, remoteReadOnly } from '@/lib/infra/databricks/client';
import { ValidationError } from '@/errors';
import { GoldQueriesDuckDBRepository, QUERY_FILES, validateAdHocSql } from '../repositories';
import type { QueryResult, QueryFile } from '../types';
import type {
  TBusinessMetricsQuery,
  TCustomerAnalyticsQuery,
  TProductPerformanceQuery,
  TCategoryRevenueQuery,
  TAdHocQuery,
} from '../schemas';

export const GoldQueriesService = {
  listAvailable(): QueryFile[] {
    return QUERY_FILES;
  },

  async runBusinessMetrics(query: TBusinessMetricsQuery): Promise<QueryResult> {
    remoteReadOnly();
    return GoldQueriesDuckDBRepository.runBusinessMetrics(query.days, query.limit);
  },

  async runCustomerAnalytics(query: TCustomerAnalyticsQuery): Promise<QueryResult> {
    remoteReadOnly();
    return GoldQueriesDuckDBRepository.runCustomerAnalytics(query.segment, query.limit);
  },

  async runProductPerformance(query: TProductPerformanceQuery): Promise<QueryResult> {
    remoteReadOnly();
    return GoldQueriesDuckDBRepository.runProductPerformance(
      query.category,
      query.days,
      query.limit,
    );
  },

  async runCategoryRevenue(query: TCategoryRevenueQuery): Promise<QueryResult> {
    remoteReadOnly();
    return GoldQueriesDuckDBRepository.runCategoryRevenue(query.parent_category, query.limit);
  },

  async runAdHoc(query: TAdHocQuery): Promise<QueryResult> {
    const guard = validateAdHocSql(query.sql);
    if (!guard.ok) {
      throw new ValidationError(guard.reason ?? 'SQL validation failed');
    }
    if (usesDatabricks()) {
      const start = Date.now();
      const sql = query.sql.trim().replace(/;$/, '');
      const rows = await readStatement(`SELECT * FROM (${sql}) AS lakehouse_preview LIMIT ${query.limit}`, query.limit);
      return { query: sql, rows, columns: rows.length ? Object.keys(rows[0] ?? {}) : [], rowCount: rows.length, durationMs: Date.now() - start };
    }
    return GoldQueriesDuckDBRepository.runQuery(query.sql, query.limit);
  },
};