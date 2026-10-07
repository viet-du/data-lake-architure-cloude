import type { CrawlerName, CrawlerMeta } from '../types';
import type { BaseCrawler } from './base-crawler';
import { TikiCrawlerImpl } from './tiki.crawler';
import { GithubCrawlerImpl } from './github.crawler';
import { CryptoCrawlerImpl } from './crypto.crawler';
import { WeatherCrawlerImpl } from './weather.crawler';
import { HackerNewsCrawlerImpl } from './hackernews.crawler';

export const tikiCrawler = new TikiCrawlerImpl();
export const githubCrawler = new GithubCrawlerImpl();
export const cryptoCrawler = new CryptoCrawlerImpl();
export const weatherCrawler = new WeatherCrawlerImpl();
export const hackerNewsCrawler = new HackerNewsCrawlerImpl();

export const CRAWLER_REGISTRY: Record<CrawlerName, BaseCrawler> = {
  tiki: tikiCrawler,
  github: githubCrawler,
  crypto: cryptoCrawler,
  weather: weatherCrawler,
  hackernews: hackerNewsCrawler,
};

export const ALL_CRAWLERS: readonly BaseCrawler[] = Object.freeze([
  tikiCrawler,
  githubCrawler,
  cryptoCrawler,
  weatherCrawler,
  hackerNewsCrawler,
]);

export function getCrawler(name: CrawlerName): BaseCrawler {
  const crawler = CRAWLER_REGISTRY[name];
  if (!crawler) throw new Error(`Unknown crawler: ${name}`);
  return crawler;
}

export function listCrawlerMeta(): CrawlerMeta[] {
  return Object.values(CRAWLER_REGISTRY).map((c) => ({
    name: c.name,
    sourceName: c.sourceName,
    description: c.description,
    kafkaTopic: c.kafkaTopic,
    maxItemsPerRun: c.maxItemsPerRun,
  }));
}