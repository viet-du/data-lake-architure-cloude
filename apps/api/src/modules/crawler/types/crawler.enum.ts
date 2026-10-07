export const CRAWLER_NAMES = [
  'tiki',
  'github',
  'crypto',
  'weather',
  'hackernews',
] as const;
export type CrawlerName = (typeof CRAWLER_NAMES)[number];

export const CRAWLER_RUN_STATUSES = [
  'queued',
  'running',
  'success',
  'failed',
  'partial',
  'cancelled',
] as const;
export type CrawlerRunStatus = (typeof CRAWLER_RUN_STATUSES)[number];

export const CRAWLER_ITEM_STATUSES = ['success', 'failed', 'skipped'] as const;
export type CrawlerItemStatus = (typeof CRAWLER_ITEM_STATUSES)[number];

export const CRAWLER_SINCE = ['daily', 'weekly', 'monthly'] as const;
export type CrawlerSince = (typeof CRAWLER_SINCE)[number];