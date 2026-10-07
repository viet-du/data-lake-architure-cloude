import { BaseCrawler, type CrawlerContext } from './base-crawler';
import type { CrawlerItem } from '../types';

const HN_API_BASE = 'https://hacker-news.firebaseio.com/v0';

interface HnItem {
  id: number;
  type?: string;
  title?: string;
  url?: string;
  score?: number;
  by?: string;
  descendants?: number;
  time?: number;
}

export class HackerNewsCrawlerImpl extends BaseCrawler {
  readonly name = 'hackernews' as const;
  readonly sourceName = 'hackernews';
  readonly description = 'Hacker News top stories';
  readonly kafkaTopic = 'hackernews.stories';
  readonly maxItemsPerRun = 100;

  async crawl(ctx: CrawlerContext): Promise<CrawlerItem[]> {
    const items: CrawlerItem[] = [];
    const maxStories = Math.min(ctx.request.maxPages * 10, this.maxItemsPerRun);
    const sinceFilter = ctx.request.since ?? 'weekly';
    const sinceTs = this.sinceTimestamp(sinceFilter);
    try {
      const ids = (await this.fetchJson(`${HN_API_BASE}/topstories.json`, {
        timeoutMs: ctx.config.timeout * 1000,
        headers: { 'User-Agent': ctx.config.userAgent },
      })) as number[] | null;
      if (!ids) {
        items.push(
          this.fail('hn-topstories', 'No story ids returned', this.timestamp()),
        );
        return items;
      }
      const selected = ids.slice(0, maxStories);
      for (const id of selected) {
        const item = await this.crawlStory(id, ctx, sinceTs);
        if (item) items.push(item);
      }
    } catch (err) {
      items.push(
        this.fail('hn-crawl', err instanceof Error ? err.message : String(err), this.timestamp()),
      );
    }
    return items;
  }

  private sinceTimestamp(since: string): number {
    const now = Math.floor(Date.now() / 1000);
    const map: Record<string, number> = {
      daily: 86_400,
      weekly: 7 * 86_400,
      monthly: 30 * 86_400,
    };
    const fallback = map.weekly ?? 0;
    const offset = map[since] ?? fallback;
    return now - offset;
  }

  private async crawlStory(
    id: number,
    ctx: CrawlerContext,
    sinceTs: number,
  ): Promise<CrawlerItem | null> {
    const data = (await this.fetchJson(`${HN_API_BASE}/item/${id}.json`, {
      timeoutMs: ctx.config.timeout * 1000,
      headers: { 'User-Agent': ctx.config.userAgent },
    })) as HnItem | null;
    const ts = this.timestamp();
    if (!data) return this.fail(`hn-story-${id}`, 'No story data', ts);
    if (data.time && data.time < sinceTs) {
      return this.skip(`hn-story-${id}`, 'Story outside since window', ts);
    }
    return this.ok(String(data.id), {
      story_id: data.id,
      title: data.title,
      url: data.url,
      score: data.score,
      by: data.by,
      descendants: data.descendants,
      type: data.type,
      time: data.time,
      crawled_at: ts,
    }, ts);
  }
}