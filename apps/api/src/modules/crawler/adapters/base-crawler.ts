import type { CrawlerConfig, CrawlerItem, CrawlerName, CrawlerRunRequest } from '../types';

export interface CrawlerContext {
  config: CrawlerConfig;
  request: CrawlerRunRequest;
  dryRun: boolean;
}

export abstract class BaseCrawler {
  abstract readonly name: CrawlerName;
  abstract readonly sourceName: string;
  abstract readonly description: string;
  abstract readonly kafkaTopic: string | null;
  abstract readonly maxItemsPerRun: number;

  abstract crawl(ctx: CrawlerContext): Promise<CrawlerItem[]>;

  protected ok(
    id: string,
    payload: Record<string, unknown>,
    crawledAt: string,
  ): CrawlerItem {
    return { id, status: 'success', payload, crawledAt };
  }

  protected fail(id: string, error: string, crawledAt: string): CrawlerItem {
    return { id, status: 'failed', payload: {}, error, crawledAt };
  }

  protected skip(id: string, reason: string, crawledAt: string): CrawlerItem {
    return {
      id,
      status: 'skipped',
      payload: { reason },
      crawledAt,
    };
  }

  protected timestamp(): string {
    return new Date().toISOString();
  }

  protected async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected async fetchJson(
    url: string,
    options: { timeoutMs?: number; headers?: Record<string, string> } = {},
  ): Promise<unknown | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: options.headers ?? {},
      });
      if (!res.ok) return null;
      return (await res.json()) as unknown;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}