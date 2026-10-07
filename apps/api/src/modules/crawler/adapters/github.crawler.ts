import { BaseCrawler, type CrawlerContext } from './base-crawler';
import type { CrawlerItem } from '../types';

const GITHUB_TRENDING_API = 'https://api.github.com/search/repositories';

interface GithubRepo {
  id: number;
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  owner: { login: string; avatar_url: string };
  topics?: string[];
  created_at: string;
  updated_at: string;
}

const SINCE_TO_DATE: Record<string, string> = {
  daily: 'pushed:>=now-1d',
  weekly: 'pushed:>=now-7d',
  monthly: 'pushed:>=now-30d',
};

export class GithubCrawlerImpl extends BaseCrawler {
  readonly name = 'github' as const;
  readonly sourceName = 'github';
  readonly description = 'GitHub trending repos crawler (by language, since)';
  readonly kafkaTopic = 'github.repos';
  readonly maxItemsPerRun = 100;

  async crawl(ctx: CrawlerContext): Promise<CrawlerItem[]> {
    const items: CrawlerItem[] = [];
    const maxPages = Math.min(ctx.request.maxPages, 10);
    const language = ctx.request.language ?? '';
    const since = ctx.request.since ?? 'weekly';
    const sinceFragment = SINCE_TO_DATE[since] ?? SINCE_TO_DATE.weekly;
    const langFragment = language ? `language:${language} ` : '';
    const query = `${langFragment}stars:>100 ${sinceFragment}`;
    try {
      for (let page = 1; page <= maxPages; page += 1) {
        const url = `${GITHUB_TRENDING_API}?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=10&page=${page}`;
        const data = (await this.fetchJson(url, {
          timeoutMs: ctx.config.timeout * 1000,
          headers: {
            'User-Agent': ctx.config.userAgent,
            Accept: 'application/vnd.github+json',
          },
        })) as { items?: GithubRepo[] } | null;
        if (!data || !data.items) {
          items.push(
            this.fail(`github-page-${page}`, 'No items returned', this.timestamp()),
          );
          break;
        }
        if (data.items.length === 0) break;
        for (const repo of data.items) {
          items.push(
            this.ok(String(repo.id), {
              repo_id: repo.id,
              full_name: repo.full_name,
              description: repo.description,
              url: repo.html_url,
              stars: repo.stargazers_count,
              forks: repo.forks_count,
              language: repo.language,
              owner: repo.owner.login,
              topics: repo.topics ?? [],
              created_at: repo.created_at,
              updated_at: repo.updated_at,
              crawled_at: this.timestamp(),
            }, this.timestamp()),
          );
        }
        await this.sleep(1000 / Math.max(ctx.config.rateLimit, 0.1));
      }
    } catch (err) {
      items.push(
        this.fail('github-crawl', err instanceof Error ? err.message : String(err), this.timestamp()),
      );
    }
    return items;
  }
}