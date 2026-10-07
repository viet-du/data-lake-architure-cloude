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
    return GoldQueriesDuckDBRepository.runBusinessMetrics(query.days, query.limit);
  },

  async runCustomerAnalytics(query: TCustomerAnalyticsQuery): Promise<QueryResult> {
    return GoldQueriesDuckDBRepository.runCustomerAnalytics(query.segment, query.limit);
  },

  async runProductPerformance(query: TProductPerformanceQuery): Promise<QueryResult> {
    return GoldQueriesDuckDBRepository.runProductPerformance(
      query.category,
      query.days,
      query.limit,
    );
  },

  async runCategoryRevenue(query: TCategoryRevenueQuery): Promise<QueryResult> {
    return GoldQueriesDuckDBRepository.runCategoryRevenue(query.parent_category, query.limit);
  },

  async runAdHoc(query: TAdHocQuery): Promise<QueryResult> {
    const guard = validateAdHocSql(query.sql);
    if (!guard.ok) {
      throw new ValidationError(guard.reason ?? 'SQL validation failed');
    }
    return GoldQueriesDuckDBRepository.runQuery(query.sql, query.limit);
  },
};