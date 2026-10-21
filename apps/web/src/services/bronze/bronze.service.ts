import { z } from 'zod';
import { decodeSample, decodeTableStats, decodeHistory } from '../lake';
import { decodeJob } from '../lake';
import { decodeLayerList, decodeLayerDetail, decodeJobs, decodeJobStats } from '../lake';
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
  items: ReadonlyArray<{ table: string; database: string; name: string }>;
  total: number;
}

export interface IngestJsonPayload {
  table: string;
  database: string;
  source: string;
}
export interface IngestCsvPayload extends IngestJsonPayload {
  options?: { header?: boolean; delimiter?: string; encoding?: string };
}
export interface IngestStreamPayload {
  database: string;
  table: string;
  consumerGroup?: string;
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
    return decodeLayerList(res.data.data);
  },

  getTable: async (table: string): Promise<BronzeTable> => {
    const res = await apiClient.get<ApiResponse<BronzeTable>>(
      ENDPOINTS.bronze.table(table),
    );
    return decodeLayerDetail(res.data.data);
  },

  getTableSample: async (table: string, limit?: number): Promise<BronzeTableSample> => {
    const res = await apiClient.get<ApiResponse<BronzeTableSample>>(
      ENDPOINTS.bronze.tableSample(table),
      { params: { limit } },
    );
    return decodeSample(res.data.data);
  },

  getTableStats: async (table: string): Promise<BronzeTableStats> => {
    const res = await apiClient.get<ApiResponse<BronzeTableStats>>(
      ENDPOINTS.bronze.tableStats(table),
    );
    return decodeTableStats(res.data.data);
  },

  getTableHistory: async (table: string): Promise<ReadonlyArray<BronzeTableHistory>> => {
    const res = await apiClient.get<ApiResponse<ReadonlyArray<BronzeTableHistory>>>(
      ENDPOINTS.bronze.tableHistory(table),
    );
    return decodeHistory(res.data.data);
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
    return mapJob(res.data.data);
  },

  ingestCsv: async (payload: IngestCsvPayload): Promise<BronzeIngestJob> => {
    const res = await apiClient.post<ApiResponse<BronzeIngestJob>>(
      ENDPOINTS.bronze.ingestCsv,
      payload,
    );
    return mapJob(res.data.data);
  },

  ingestStream: async (topic: string, payload: IngestStreamPayload): Promise<BronzeIngestJob> => {
    const res = await apiClient.post<ApiResponse<BronzeIngestJob>>(
      ENDPOINTS.bronze.ingestStream(topic),
      payload,
    );
    return mapJob(res.data.data);
  },

  listJobs: async (): Promise<ReadonlyArray<BronzeIngestJob>> => {
    const res = await apiClient.get<ApiResponse<ReadonlyArray<BronzeIngestJob>>>(
      ENDPOINTS.bronze.jobs,
    );
    return decodeJobs(res.data.data).map(mapJob);
  },

  getJobStats: async (): Promise<BronzeJobsStats> => {
    const res = await apiClient.get<ApiResponse<BronzeJobsStats>>(
      ENDPOINTS.bronze.jobsStats,
    );
    return mapStats(res.data.data);
  },

  getJob: async (jobId: string): Promise<BronzeIngestJob> => {
    const res = await apiClient.get<ApiResponse<BronzeIngestJob>>(
      ENDPOINTS.bronze.job(jobId),
    );
    return mapJob(res.data.data);
  },

  cancelJob: async (jobId: string): Promise<void> => {
    await apiClient.delete<ApiResponse<null>>(ENDPOINTS.bronze.job(jobId));
  },
};

function mapStats(input: unknown) {
  const value = decodeJobStats(input);
  return { ...value, totalRecordsIngested: z.number().parse(value.totalRowsIngested), totalBytesIngested: z.number().parse(value.totalBytesProcessed) };
}

function mapJob(input: unknown) {
  const value = decodeJob(input);
  return { ...value, source: value.kind === 'stream' ? 'kafka' as const : value.kind === 'csv' ? 'csv' as const : 'json' as const, recordsIngested: value.rowCount, bytesIngested: value.bytesProcessed };
}
