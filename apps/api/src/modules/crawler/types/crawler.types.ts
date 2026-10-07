import type { CrawlerItemStatus, CrawlerName, CrawlerRunStatus, CrawlerSince } from './crawler.enum';

export interface CrawlerMeta {
  name: CrawlerName;
  sourceName: string;
  description: string;
  kafkaTopic: string | null;
  defaultCategory?: string;
  defaultLanguage?: string;
  maxItemsPerRun: number;
}

export interface CrawlerConfig {
  rateLimit: number;
  maxRetries: number;
  timeout: number;
  maxWorkers: number;
  kafkaTopic: string | null;
  userAgent: string;
}

export interface CrawlerItem {
  id: string;
  status: CrawlerItemStatus;
  payload: Record<string, unknown>;
  error?: string;
  crawledAt: string;
}

export interface CrawlerRun {
  runId: string;
  crawler: CrawlerName;
  status: CrawlerRunStatus;
  requestedBy?: string;
  request: {
    category?: string;
    maxPages: number;
    language?: string;
    since?: CrawlerSince;
    dryRun: boolean;
  };
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  items: CrawlerItem[];
  stats: {
    total: number;
    success: number;
    failed: number;
    skipped: number;
  };
  errorMessage?: string;
  parentJobId?: string;
}

export interface CrawlerRunSummary {
  runId: string;
  crawler: CrawlerName;
  status: CrawlerRunStatus;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  itemsTotal: number;
  itemsSuccess: number;
  itemsFailed: number;
  itemsSkipped: number;
  dryRun: boolean;
}

export interface CrawlerStats {
  crawler: CrawlerName;
  totalRuns: number;
  successRuns: number;
  failedRuns: number;
  cancelledRuns: number;
  totalItems: number;
  totalSuccess: number;
  totalFailed: number;
  totalSkipped: number;
  lastRunAt?: string;
  lastSuccessAt?: string;
}

export interface CrawlerRunRequest {
  category?: string;
  maxPages: number;
  language?: string;
  since?: CrawlerSince;
  dryRun: boolean;
}