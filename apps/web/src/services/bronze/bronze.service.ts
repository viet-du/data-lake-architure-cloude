import { apiClient } from '../api';
import { ENDPOINTS } from '../api/endpoints';
import type { ApiResponse } from '@/types/commons';
import type {
  BronzeTable,
  BronzeTableStats,
  BronzeTableHistory,
  BronzeTablePartition,
  BronzeTableSample,
  BronzeIngestJob,
  BronzeJobsStats,
} from '@/types/entities';

export interface ListBronzeTablesParams {
  database?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ListBronzeTablesResult {
  items: ReadonlyArray<BronzeTable>;
  total: number;
}

export interface IngestJsonPayload {
  table: string;
  database: string;
  data: ReadonlyArray<Readonly<Record<string, unknown>>>;
  mode?: 'append' | 'overwrite' | 'merge';
}

export interface IngestCsvPayload {
  table: string;
  database: string;
  fileUrl: string;
  delimiter?: string;
  hasHeader?: boolean;
  mode?: 'append' | 'overwrite';
}

export interface IngestStreamPayload {
  database: string;
  table: string;
  checkpointLocation?: string;
}

export interface VacuumPayload {
  retentionDays?: number;
  dryRun?: boolean;
}

export const bronzeService = {
  listTables: async (params: ListBronzeTablesParams = {}): Promise<ListBronzeTablesResult> => {
    const res = await apiClient.get<ApiResponse<ListBronzeTablesResult>>(
      ENDPOINTS.bronze.tables,
      { params: { ...params } },
    );
    return res.data.data;
  },

  getTable: async (table: string): Promise<BronzeTable> => {
    const res = await apiClient.get<ApiResponse<BronzeTable>>(
      ENDPOINTS.bronze.table(table),
    );
    return res.data.data;
  },

  getTableSample: async (table: string, limit?: number): Promise<BronzeTableSample> => {
    const res = await apiClient.get<ApiResponse<BronzeTableSample>>(
      ENDPOINTS.bronze.tableSample(table),
      { params: { limit } },
    );
    return res.data.data;
  },

  getTableStats: async (table: string): Promise<BronzeTableStats> => {
    const res = await apiClient.get<ApiResponse<BronzeTableStats>>(
      ENDPOINTS.bronze.tableStats(table),
    );
    return res.data.data;
  },

  getTableHistory: async (table: string): Promise<ReadonlyArray<BronzeTableHistory>> => {
    const res = await apiClient.get<ApiResponse<ReadonlyArray<BronzeTableHistory>>>(
      ENDPOINTS.bronze.tableHistory(table),
    );
    return res.data.data;
  },

  getTablePartitions: async (table: string): Promise<ReadonlyArray<BronzeTablePartition>> => {
    const res = await apiClient.get<ApiResponse<ReadonlyArray<BronzeTablePartition>>>(
      ENDPOINTS.bronze.tablePartitions(table),
    );
    return res.data.data;
  },

  deletePartition: async (table: string, date: string): Promise<void> => {
    await apiClient.delete<ApiResponse<null>>(ENDPOINTS.bronze.tablePartition(table, date));
  },

  vacuum: async (table: string, payload: VacuumPayload = {}): Promise<unknown> => {
    const res = await apiClient.post<ApiResponse<unknown>>(
      ENDPOINTS.bronze.vacuum(table),
      payload,
    );
    return res.data.data;
  },

  ingestJson: async (payload: IngestJsonPayload): Promise<BronzeIngestJob> => {
    const res = await apiClient.post<ApiResponse<BronzeIngestJob>>(
      ENDPOINTS.bronze.ingestJson,
      payload,
    );
    return res.data.data;
  },

  ingestCsv: async (payload: IngestCsvPayload): Promise<BronzeIngestJob> => {
    const res = await apiClient.post<ApiResponse<BronzeIngestJob>>(
      ENDPOINTS.bronze.ingestCsv,
      payload,
    );
    return res.data.data;
  },

  ingestStream: async (topic: string, payload: IngestStreamPayload): Promise<BronzeIngestJob> => {
    const res = await apiClient.post<ApiResponse<BronzeIngestJob>>(
      ENDPOINTS.bronze.ingestStream(topic),
      payload,
    );
    return res.data.data;
  },

  listJobs: async (): Promise<ReadonlyArray<BronzeIngestJob>> => {
    const res = await apiClient.get<ApiResponse<ReadonlyArray<BronzeIngestJob>>>(
      ENDPOINTS.bronze.jobs,
    );
    return res.data.data;
  },

  getJobStats: async (): Promise<BronzeJobsStats> => {
    const res = await apiClient.get<ApiResponse<BronzeJobsStats>>(
      ENDPOINTS.bronze.jobsStats,
    );
    return res.data.data;
  },

  getJob: async (jobId: string): Promise<BronzeIngestJob> => {
    const res = await apiClient.get<ApiResponse<BronzeIngestJob>>(
      ENDPOINTS.bronze.job(jobId),
    );
    return res.data.data;
  },

  cancelJob: async (jobId: string): Promise<void> => {
    await apiClient.delete<ApiResponse<null>>(ENDPOINTS.bronze.job(jobId));
  },
};
