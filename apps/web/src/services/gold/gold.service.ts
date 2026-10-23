import { z } from 'zod';
import { decodeSample, decodeTableStats, decodeHistory } from '../lake';
import { decodeJob } from '../lake';
import { decodeLayerList, decodeLayerDetail, decodeJobs, decodeJobStats } from '../lake';
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
  items: ReadonlyArray<{ table: string; database: string; name: string }>;
  total: number;
}

export interface AggregatePayload {
  sourceTables?: ReadonlyArray<string>;
  kind: 'full' | 'incremental' | 'refresh';
}
export interface AggregateAllPayload {
  kind: 'full' | 'incremental' | 'refresh';
  parallel?: number;
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
    return decodeLayerList(res.data.data);
  },

  getTable: async (table: string): Promise<GoldTable> => {
    const res = await apiClient.get<ApiResponse<GoldTable>>(
      ENDPOINTS.gold.table(table),
    );
    return decodeLayerDetail(res.data.data);
  },

  getTableSample: async (table: string, limit?: number): Promise<GoldTableSample> => {
    const res = await apiClient.get<ApiResponse<GoldTableSample>>(
      ENDPOINTS.gold.tableSample(table),
      { params: { limit } },
    );
    return decodeSample(res.data.data);
  },

  getTableStats: async (table: string): Promise<GoldTableStats> => {
    const res = await apiClient.get<ApiResponse<GoldTableStats>>(
      ENDPOINTS.gold.tableStats(table),
    );
    return decodeTableStats(res.data.data);
  },

  getTableHistory: async (table: string): Promise<ReadonlyArray<GoldTableHistory>> => {
    const res = await apiClient.get<ApiResponse<ReadonlyArray<GoldTableHistory>>>(
      ENDPOINTS.gold.tableHistory(table),
    );
    return decodeHistory(res.data.data);
  },

  getTableLineage: async (table: string): Promise<unknown> => {
    const res = await apiClient.get<ApiResponse<unknown>>(
      ENDPOINTS.gold.tableLineage(table),
    );
    return res.data.data;
  },

  aggregate: async (table: string, payload: AggregatePayload): Promise<GoldAggregateJob> => {
    const res = await apiClient.post<ApiResponse<GoldAggregateJob>>(
      ENDPOINTS.gold.tableAggregate(table),
      payload,
    );
    return mapJob(res.data.data);
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
    return mapJob(res.data.data);
  },

  listJobs: async (): Promise<ReadonlyArray<GoldAggregateJob>> => {
    const res = await apiClient.get<ApiResponse<ReadonlyArray<GoldAggregateJob>>>(
      ENDPOINTS.gold.jobs,
    );
    return decodeJobs(res.data.data).map(mapJob);
  },

  getJobStats: async (): Promise<GoldJobsStats> => {
    const res = await apiClient.get<ApiResponse<GoldJobsStats>>(
      ENDPOINTS.gold.jobsStats,
    );
    return mapStats(res.data.data);
  },

  getJob: async (jobId: string): Promise<GoldAggregateJob> => {
    const res = await apiClient.get<ApiResponse<GoldAggregateJob>>(
      ENDPOINTS.gold.job(jobId),
    );
    return mapJob(res.data.data);
  },

  cancelJob: async (jobId: string): Promise<void> => {
    await apiClient.delete<ApiResponse<null>>(ENDPOINTS.gold.job(jobId));
  },

  getCategoryRevenue: async (): Promise<GoldQueryResult> => {
    const res = await apiClient.get<ApiResponse<GoldQueryResult>>(
      ENDPOINTS.gold.queries.categoryRevenue,
    );
    return decodeQuery(res.data.data);
  },

  getBusinessMetrics: async (): Promise<GoldQueryResult> => {
    const res = await apiClient.get<ApiResponse<GoldQueryResult>>(
      ENDPOINTS.gold.queries.businessMetrics,
    );
    return decodeQuery(res.data.data);
  },

  getCustomerAnalytics: async (): Promise<GoldQueryResult> => {
    const res = await apiClient.get<ApiResponse<GoldQueryResult>>(
      ENDPOINTS.gold.queries.customerAnalytics,
    );
    return decodeQuery(res.data.data);
  },

  getProductPerformance: async (): Promise<GoldQueryResult> => {
    const res = await apiClient.get<ApiResponse<GoldQueryResult>>(
      ENDPOINTS.gold.queries.productPerformance,
    );
    return decodeQuery(res.data.data);
  },

  runAdHocQuery: async (params: AdHocQueryParams): Promise<GoldQueryResult> => {
    const res = await apiClient.get<ApiResponse<GoldQueryResult>>(
      ENDPOINTS.gold.queries.adHoc,
      { params: { ...params } },
    );
    return decodeQuery(res.data.data);
  },
};

function mapStats(input: unknown) {
  const value = decodeJobStats(input);
  return { ...value, totalRecordsProcessed: z.number().parse(value.totalRowsAggregated) };
}

function mapJob(input: unknown) {
  const value = decodeJob(input);
  return { ...value, recordsProcessed: value.rowCount, aggregateType: value.kind };
}

function decodeQuery(input: unknown): GoldQueryResult {
  const value = z.object({ query: z.string(), rowCount: z.number(), rows: z.array(z.record(z.unknown())), columns: z.array(z.string()), durationMs: z.number() }).parse(input);
  return { queryName: value.query, rows: value.rows, columns: value.columns, totalRows: value.rowCount, executionMs: value.durationMs };
}
