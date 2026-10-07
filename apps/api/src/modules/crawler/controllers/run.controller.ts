import { CrawlerService } from '../services/crawler.service';
import type {
  CrawlerRun,
  CrawlerRunSummary,
  CrawlerItem,
} from '../types';
import type {
  TCrawlerNameParam,
  TCrawlerRunIdParam,
  TCrawlerRunsListQuery,
  TCrawlerRunItemsQuery,
  TCrawlerRunRequestBody,
  TCrawlerPreviewQuery,
} from '../schemas';

export const CrawlerRunController = {
  async runSync(params: TCrawlerNameParam, body: TCrawlerRunRequestBody): Promise<CrawlerRun> {
    return CrawlerService.runSync(params.name, body);
  },

  async runAsync(params: TCrawlerNameParam, body: TCrawlerRunRequestBody) {
    return CrawlerService.runAsync(params.name, body);
  },

  async stop(params: TCrawlerRunIdParam) {
    return CrawlerService.stopRun(params);
  },

  async listRuns(
    params: TCrawlerNameParam,
    query: TCrawlerRunsListQuery,
  ): Promise<{ total: number; items: CrawlerRunSummary[] }> {
    return CrawlerService.listRuns(params, query);
  },

  async getRun(params: TCrawlerRunIdParam): Promise<CrawlerRun> {
    return CrawlerService.getRun(params);
  },

  async listItems(
    params: TCrawlerRunIdParam,
    query: TCrawlerRunItemsQuery,
  ): Promise<{ total: number; items: CrawlerItem[] }> {
    return CrawlerService.listRunItems(params, query);
  },

  async preview(params: TCrawlerNameParam, query: TCrawlerPreviewQuery) {
    return CrawlerService.preview(params.name, query);
  },
};