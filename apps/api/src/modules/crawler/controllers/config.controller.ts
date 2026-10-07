import { CrawlerService } from '../services/crawler.service';
import type { CrawlerConfig } from '../types';
import type { TCrawlerNameParam, TCrawlerConfigBody } from '../schemas';

export const CrawlerConfigController = {
  async get(params: TCrawlerNameParam): Promise<CrawlerConfig> {
    return CrawlerService.getConfig(params.name);
  },

  async update(params: TCrawlerNameParam, body: TCrawlerConfigBody): Promise<CrawlerConfig> {
    return CrawlerService.updateConfig(params.name, body);
  },
};