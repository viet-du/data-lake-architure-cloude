import { apiClient } from '../api';
import { ENDPOINTS } from '../api/endpoints';
import type { ApiResponse } from '@/types/commons';
import type {
  CrawlerJob,
  CrawlerConfig,
  CrawlerPreviewItem,
  CrawlerRun,
  CrawlerRunItem,
  CrawlerKafkaTopic,
  CrawlerStats,
} from '@/types/entities';

export interface ListCrawlerRunsParams {
  limit?: number;
  offset?: number;
  status?: 'queued' | 'running' | 'success' | 'failed' | 'cancelled';
}

export interface RunJobPayload {
  pages?: number;
  categories?: ReadonlyArray<string>;
  async?: boolean;
}

export const crawlerService = {
  listJobs: async (): Promise<ReadonlyArray<CrawlerJob>> => {
    const res = await apiClient.get<ApiResponse<ReadonlyArray<CrawlerJob>>>(
      ENDPOINTS.crawler.jobs,
    );
    return res.data.data;
  },

  getJob: async (name: string): Promise<CrawlerJob> => {
    const res = await apiClient.get<ApiResponse<CrawlerJob>>(
      ENDPOINTS.crawler.job(name),
    );
    return res.data.data;
  },

  getConfig: async (name: string): Promise<CrawlerConfig> => {
    const res = await apiClient.get<ApiResponse<CrawlerConfig>>(
      ENDPOINTS.crawler.jobConfig(name),
    );
    return res.data.data;
  },

  updateConfig: async (name: string, config: Partial<CrawlerConfig>): Promise<CrawlerConfig> => {
    const res = await apiClient.put<ApiResponse<CrawlerConfig>>(
      ENDPOINTS.crawler.jobConfig(name),
      config,
    );
    return res.data.data;
  },

  getKafkaTopic: async (name: string): Promise<CrawlerKafkaTopic> => {
    const res = await apiClient.get<ApiResponse<CrawlerKafkaTopic>>(
      ENDPOINTS.crawler.jobKafkaTopic(name),
    );
    return res.data.data;
  },

  runJob: async (name: string, payload: RunJobPayload = {}): Promise<CrawlerRun> => {
    const res = await apiClient.post<ApiResponse<CrawlerRun>>(
      ENDPOINTS.crawler.jobRun(name),
      payload,
    );
    return res.data.data;
  },

  runJobAsync: async (name: string, payload: RunJobPayload = {}): Promise<CrawlerRun> => {
    const res = await apiClient.post<ApiResponse<CrawlerRun>>(
      ENDPOINTS.crawler.jobRunAsync(name),
      payload,
    );
    return res.data.data;
  },

  stopJob: async (name: string): Promise<void> => {
    await apiClient.post<ApiResponse<null>>(ENDPOINTS.crawler.jobStop(name), {});
  },

  getPreview: async (name: string, limit?: number): Promise<ReadonlyArray<CrawlerPreviewItem>> => {
    const res = await apiClient.get<ApiResponse<ReadonlyArray<CrawlerPreviewItem>>>(
      ENDPOINTS.crawler.jobPreview(name),
      { params: { limit } },
    );
    return res.data.data;
  },

  listRuns: async (name: string, params: ListCrawlerRunsParams = {}): Promise<ReadonlyArray<CrawlerRun>> => {
    const res = await apiClient.get<ApiResponse<ReadonlyArray<CrawlerRun>>>(
      ENDPOINTS.crawler.jobRuns(name),
      { params: { ...params } },
    );
    return res.data.data;
  },

  getRun: async (name: string, runId: string): Promise<CrawlerRun> => {
    const res = await apiClient.get<ApiResponse<CrawlerRun>>(
      ENDPOINTS.crawler.jobRun_(name, runId),
    );
    return res.data.data;
  },

  getRunItems: async (
    name: string,
    runId: string,
    limit?: number,
  ): Promise<ReadonlyArray<CrawlerRunItem>> => {
    const res = await apiClient.get<ApiResponse<ReadonlyArray<CrawlerRunItem>>>(
      ENDPOINTS.crawler.jobRunItems(name, runId),
      { params: { limit } },
    );
    return res.data.data;
  },

  getStats: async (): Promise<CrawlerStats> => {
    const res = await apiClient.get<ApiResponse<CrawlerStats>>(ENDPOINTS.crawler.stats);
    return res.data.data;
  },
};
