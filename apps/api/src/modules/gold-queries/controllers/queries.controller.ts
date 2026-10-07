import { GoldQueriesService } from '../services/queries.service';
import type { QueryResult, QueryFile } from '../types';
import type {
  TBusinessMetricsQuery,
  TCustomerAnalyticsQuery,
  TProductPerformanceQuery,
  TCategoryRevenueQuery,
  TAdHocQuery,
} from '../schemas';

export const GoldQueriesController = {
  list(): QueryFile[] {
    return GoldQueriesService.listAvailable();
  },

  async businessMetrics(query: TBusinessMetricsQuery): Promise<QueryResult> {
    return GoldQueriesService.runBusinessMetrics(query);
  },

  async customerAnalytics(query: TCustomerAnalyticsQuery): Promise<QueryResult> {
    return GoldQueriesService.runCustomerAnalytics(query);
  },

  async productPerformance(query: TProductPerformanceQuery): Promise<QueryResult> {
    return GoldQueriesService.runProductPerformance(query);
  },

  async categoryRevenue(query: TCategoryRevenueQuery): Promise<QueryResult> {
    return GoldQueriesService.runCategoryRevenue(query);
  },

  async adHoc(query: TAdHocQuery): Promise<QueryResult> {
    return GoldQueriesService.runAdHoc(query);
  },
};