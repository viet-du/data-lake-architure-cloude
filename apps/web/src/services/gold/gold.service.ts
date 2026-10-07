import { apiClient } from '../api';
import { ENDPOINTS } from '../api/endpoints';
import type { ApiResponse } from '@/types/commons';
import type {
  GoldTable,
  GoldTableStats,
  GoldTableHistory,
  GoldTableSample,
  GoldAggregateResult,
  GoldAggregateJob,
  GoldJobsStats,
  GoldQueryResult,
} from '@/types/entities';

export interface ListGoldTablesParams {
  database?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ListGoldTablesResult {
  items: ReadonlyArray<GoldTable>;
  total: number;
}

export interface AggregatePayload {
  groupBy: ReadonlyArray<string>;
  metrics: ReadonlyArray<{ name: string; op: 'sum' | 'avg' | 'count' | 'min' | 'max' }>;
  filters?: Readonly<Record<string, unknown>>;
}

export interface AggregateAllPayload {
  table: string;
  operations: ReadonlyArray<AggregatePayload>;
}

export interface AdHocQueryParams {
  sql: string;
  limit?: number;
}

export const goldService = {
  listTables: async (params: ListGoldTablesParams = {}): Promise<ListGoldTablesResult> => {
    const res = await apiClient.get<ApiResponse<ListGoldTablesResult>>(
      ENDPOINTS.gold.tables,
      { params: { ...params } },
    );
    return res.data.data;
  },

  getTable: async (table: string): Promise<GoldTable> => {
    const res = await apiClient.get<ApiResponse<GoldTable>>(
      ENDPOINTS.gold.table(table),
    );
    return res.data.data;
  },

  getTableSample: async (table: string, limit?: number): Promise<GoldTableSample> => {
    const res = await apiClient.get<ApiResponse<GoldTableSample>>(
      ENDPOINTS.gold.tableSample(table),
      { params: { limit } },
    );
    return res.data.data;
  },

  getTableStats: async (table: string): Promise<GoldTableStats> => {
    const res = await apiClient.get<ApiResponse<GoldTableStats>>(
      ENDPOINTS.gold.tableStats(table),
    );
    return res.data.data;
  },

  getTableHistory: async (table: string): Promise<ReadonlyArray<GoldTableHistory>> => {
    const res = await apiClient.get<ApiResponse<ReadonlyArray<GoldTableHistory>>>(
      ENDPOINTS.gold.tableHistory(table),
    );
    return res.data.data;
  },

  getTableLineage: async (table: string): Promise<unknown> => {
    const res = await apiClient.get<ApiResponse<unknown>>(
      ENDPOINTS.gold.tableLineage(table),
    );
    return res.data.data;
  },

  aggregate: async (table: string, payload: AggregatePayload): Promise<GoldAggregateResult> => {
    const res = await apiClient.post<ApiResponse<GoldAggregateResult>>(
      ENDPOINTS.gold.tableAggregate(table),
      payload,
    );
    return res.data.data;
  },

  aggregateAll: async (payload: AggregateAllPayload): Promise<ReadonlyArray<GoldAggregateResult>> => {
    const res = await apiClient.post<ApiResponse<ReadonlyArray<GoldAggregateResult>>>(
      ENDPOINTS.gold.aggregateAll,
      payload,
    );
    return res.data.data;
  },

  refresh: async (table: string): Promise<GoldAggregateJob> => {
    const res = await apiClient.post<ApiResponse<GoldAggregateJob>>(
      ENDPOINTS.gold.tableRefresh(table),
      {},
    );
    return res.data.data;
  },

  listJobs: async (): Promise<ReadonlyArray<GoldAggregateJob>> => {
    const res = await apiClient.get<ApiResponse<ReadonlyArray<GoldAggregateJob>>>(
      ENDPOINTS.gold.jobs,
    );
    return res.data.data;
  },

  getJobStats: async (): Promise<GoldJobsStats> => {
    const res = await apiClient.get<ApiResponse<GoldJobsStats>>(
      ENDPOINTS.gold.jobsStats,
    );
    return res.data.data;
  },

  getJob: async (jobId: string): Promise<GoldAggregateJob> => {
    const res = await apiClient.get<ApiResponse<GoldAggregateJob>>(
      ENDPOINTS.gold.job(jobId),
    );
    return res.data.data;
  },

  cancelJob: async (jobId: string): Promise<void> => {
    await apiClient.delete<ApiResponse<null>>(ENDPOINTS.gold.job(jobId));
  },

  getCategoryRevenue: async (): Promise<GoldQueryResult> => {
    const res = await apiClient.get<ApiResponse<GoldQueryResult>>(
      ENDPOINTS.gold.queries.categoryRevenue,
    );
    return res.data.data;
  },

  getBusinessMetrics: async (): Promise<GoldQueryResult> => {
    const res = await apiClient.get<ApiResponse<GoldQueryResult>>(
      ENDPOINTS.gold.queries.businessMetrics,
    );
    return res.data.data;
  },

  getCustomerAnalytics: async (): Promise<GoldQueryResult> => {
    const res = await apiClient.get<ApiResponse<GoldQueryResult>>(
      ENDPOINTS.gold.queries.customerAnalytics,
    );
    return res.data.data;
  },

  getProductPerformance: async (): Promise<GoldQueryResult> => {
    const res = await apiClient.get<ApiResponse<GoldQueryResult>>(
      ENDPOINTS.gold.queries.productPerformance,
    );
    return res.data.data;
  },

  runAdHocQuery: async (params: AdHocQueryParams): Promise<GoldQueryResult> => {
    const res = await apiClient.get<ApiResponse<GoldQueryResult>>(
      ENDPOINTS.gold.queries.adHoc,
      { params: { ...params } },
    );
    return res.data.data;
  },
};
