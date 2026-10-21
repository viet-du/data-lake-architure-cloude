import { z } from 'zod';
import { decodeCrawlerConfig, decodeCrawlerTopic, decodeRunItems, decodePreview } from './crawler.adapter';
import { decodeCrawler, decodeCrawlers, decodeCrawlerRun, decodeCrawlerStats, decodeCrawlerItems, crawlerPayload } from './crawler.adapter';
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
    return decodeCrawlers(res.data.data);
  },

  getJob: async (name: string): Promise<CrawlerJob> => {
    const res = await apiClient.get<ApiResponse<CrawlerJob>>(
      ENDPOINTS.crawler.job(name),
    );
    return decodeCrawler(res.data.data);
  },

  getConfig: async (name: string): Promise<CrawlerConfig> => {
    const res = await apiClient.get<ApiResponse<CrawlerConfig>>(
      ENDPOINTS.crawler.jobConfig(name),
    );
    return decodeCrawlerConfig(res.data.data);
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
    return decodeCrawlerTopic(res.data.data);
  },

  runJob: async (name: string, payload: RunJobPayload = {}): Promise<CrawlerRun> => {
    const res = await apiClient.post<ApiResponse<CrawlerRun>>(
      ENDPOINTS.crawler.jobRun(name),
      crawlerPayload(payload),
    );
    return decodeCrawlerRun(res.data.data);
  },

  runJobAsync: async (name: string, payload: RunJobPayload = {}): Promise<CrawlerRun> => {
    const res = await apiClient.post<ApiResponse<CrawlerRun>>(
      ENDPOINTS.crawler.jobRunAsync(name),
      crawlerPayload(payload),
    );
    const value = z.object({ runId: z.string(), status: z.literal('queued') }).parse(res.data.data);
    return crawlerService.getRun(name, value.runId);
  },

  stopJob: async (name: string): Promise<void> => {
    await apiClient.post<ApiResponse<null>>(ENDPOINTS.crawler.jobStop(name), {});
  },

  getPreview: async (name: string, limit?: number): Promise<ReadonlyArray<CrawlerPreviewItem>> => {
    const res = await apiClient.get<ApiResponse<ReadonlyArray<CrawlerPreviewItem>>>(
      ENDPOINTS.crawler.jobPreview(name),
      { params: { maxItems: Math.min(limit ?? 3, 20) } },
    );
    return decodePreview(res.data.data);
  },

  listRuns: async (name: string, params: ListCrawlerRunsParams = {}): Promise<ReadonlyArray<CrawlerRun>> => {
    const res = await apiClient.get<ApiResponse<ReadonlyArray<CrawlerRun>>>(
      ENDPOINTS.crawler.jobRuns(name),
      { params: { ...params } },
    );
    return decodeCrawlerItems(res.data.data).map(decodeCrawlerRun);
  },

  getRun: async (name: string, runId: string): Promise<CrawlerRun> => {
    const res = await apiClient.get<ApiResponse<CrawlerRun>>(
      ENDPOINTS.crawler.jobRun_(name, runId),
    );
    return decodeCrawlerRun(res.data.data);
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
    return decodeRunItems(res.data.data);
  },

  getStats: async (): Promise<CrawlerStats> => {
    const res = await apiClient.get<ApiResponse<CrawlerStats>>(ENDPOINTS.crawler.stats);
    return decodeCrawlerStats(res.data.data);
  },
};
