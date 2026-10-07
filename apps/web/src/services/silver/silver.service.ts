import { apiClient } from '../api';
import { ENDPOINTS } from '../api/endpoints';
import type { ApiResponse } from '@/types/commons';
import type {
  SilverTable,
  SilverTableStats,
  SilverTableHistory,
  SilverTableSample,
  SilverTransformJob,
  SilverTimeTravel,
  SilverTableDiff,
  SilverJobsStats,
} from '@/types/entities';

export interface ListSilverTablesParams {
  database?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ListSilverTablesResult {
  items: ReadonlyArray<SilverTable>;
  total: number;
}

export interface TransformPayload {
  sourceTable: string;
  transformRule: string;
  mode?: 'full' | 'incremental';
  checkpointLocation?: string;
}

export interface TransformAllPayload {
  rules: ReadonlyArray<TransformPayload>;
  parallel?: number;
}

export const silverService = {
  listTables: async (params: ListSilverTablesParams = {}): Promise<ListSilverTablesResult> => {
    const res = await apiClient.get<ApiResponse<ListSilverTablesResult>>(
      ENDPOINTS.silver.tables,
      { params: { ...params } },
    );
    return res.data.data;
  },

  getTable: async (table: string): Promise<SilverTable> => {
    const res = await apiClient.get<ApiResponse<SilverTable>>(
      ENDPOINTS.silver.table(table),
    );
    return res.data.data;
  },

  getTableSample: async (table: string, limit?: number): Promise<SilverTableSample> => {
    const res = await apiClient.get<ApiResponse<SilverTableSample>>(
      ENDPOINTS.silver.tableSample(table),
      { params: { limit } },
    );
    return res.data.data;
  },

  getTableStats: async (table: string): Promise<SilverTableStats> => {
    const res = await apiClient.get<ApiResponse<SilverTableStats>>(
      ENDPOINTS.silver.tableStats(table),
    );
    return res.data.data;
  },

  getTableHistory: async (table: string): Promise<ReadonlyArray<SilverTableHistory>> => {
    const res = await apiClient.get<ApiResponse<ReadonlyArray<SilverTableHistory>>>(
      ENDPOINTS.silver.tableHistory(table),
    );
    return res.data.data;
  },

  getTablePartitions: async (table: string): Promise<ReadonlyArray<unknown>> => {
    const res = await apiClient.get<ApiResponse<ReadonlyArray<unknown>>>(
      ENDPOINTS.silver.tablePartitions(table),
    );
    return res.data.data;
  },

  getTableDiff: async (table: string, v1: string, v2: string): Promise<SilverTableDiff> => {
    const res = await apiClient.get<ApiResponse<SilverTableDiff>>(
      ENDPOINTS.silver.tableDiff(table, v1, v2),
    );
    return res.data.data;
  },

  getTimeTravel: async (table: string, version: string): Promise<SilverTimeTravel> => {
    const res = await apiClient.get<ApiResponse<SilverTimeTravel>>(
      ENDPOINTS.silver.tableTimeTravel(table, version),
    );
    return res.data.data;
  },

  refresh: async (table: string): Promise<SilverTransformJob> => {
    const res = await apiClient.post<ApiResponse<SilverTransformJob>>(
      ENDPOINTS.silver.tableRefresh(table),
      {},
    );
    return res.data.data;
  },

  transform: async (table: string, payload: TransformPayload): Promise<SilverTransformJob> => {
    const res = await apiClient.post<ApiResponse<SilverTransformJob>>(
      ENDPOINTS.silver.tableTransform(table),
      payload,
    );
    return res.data.data;
  },

  transformAll: async (payload: TransformAllPayload): Promise<ReadonlyArray<SilverTransformJob>> => {
    const res = await apiClient.post<ApiResponse<ReadonlyArray<SilverTransformJob>>>(
      ENDPOINTS.silver.transformAll,
      payload,
    );
    return res.data.data;
  },

  listJobs: async (): Promise<ReadonlyArray<SilverTransformJob>> => {
    const res = await apiClient.get<ApiResponse<ReadonlyArray<SilverTransformJob>>>(
      ENDPOINTS.silver.jobs,
    );
    return res.data.data;
  },

  getJobStats: async (): Promise<SilverJobsStats> => {
    const res = await apiClient.get<ApiResponse<SilverJobsStats>>(
      ENDPOINTS.silver.jobsStats,
    );
    return res.data.data;
  },

  getJob: async (jobId: string): Promise<SilverTransformJob> => {
    const res = await apiClient.get<ApiResponse<SilverTransformJob>>(
      ENDPOINTS.silver.job(jobId),
    );
    return res.data.data;
  },

  cancelJob: async (jobId: string): Promise<void> => {
    await apiClient.delete<ApiResponse<null>>(ENDPOINTS.silver.job(jobId));
  },
};
