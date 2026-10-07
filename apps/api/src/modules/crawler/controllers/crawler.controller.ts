import { CrawlerService } from '../services/crawler.service';
import type {
  CrawlerMeta,
  CrawlerStats,
} from '../types';
import type { TCrawlerNameParam } from '../schemas';

export const CrawlerController = {
  list(): CrawlerMeta[] {
    return CrawlerService.list();
  },

  async getMeta(params: TCrawlerNameParam): Promise<CrawlerMeta> {
    return CrawlerService.getMeta(params.name);
  },

  async stats(): Promise<CrawlerStats[]> {
    return CrawlerService.stats();
  },

  async getKafkaTopic(params: TCrawlerNameParam) {
    return CrawlerService.getKafkaTopic(params.name);
  },

  async getConfig(params: TCrawlerNameParam) {
    return CrawlerService.getConfig(params.name);
  },
};