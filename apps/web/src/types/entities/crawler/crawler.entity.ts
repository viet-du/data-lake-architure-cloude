import type { EHealthStatus } from '@/types/commons';

export type ECrawlerStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';
export type ECrawlerRunStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled';

export interface CrawlerJob {
  name: string;
  source: string;
  category: string;
  status: ECrawlerStatus;
  ratePerMinute: number;
  maxWorkers: number;
  startedAt: string;
  finishedAt?: string;
  pagesScraped: number;
  recordsCollected: number;
  recordsFailed: number;
  kafkaTopic?: string;
  errorMessage?: string;
  health: EHealthStatus;
}

export interface CrawlerConfig {
  name: string;
  source: string;
  category: string;
  baseUrl: string;
  ratePerMinute: number;
  maxWorkers: number;
  timeoutSec: number;
  headers: Readonly<Record<string, string>>;
  proxyEnabled: boolean;
  retries: number;
}

export interface CrawlerPreviewItem {
  url: string;
  title: string;
  price?: number;
  sku?: string;
  category?: string;
}

export interface CrawlerRun {
  runId: string;
  name: string;
  status: ECrawlerRunStatus;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  pagesScraped: number;
  recordsCollected: number;
  recordsFailed: number;
  triggeredBy: 'manual' | 'schedule' | 'api';
  errorMessage?: string;
}

export interface CrawlerRunItem {
  url: string;
  status: 'success' | 'failed' | 'skipped';
  attempts: number;
  durationMs: number;
  errorMessage?: string;
  data?: Readonly<Record<string, unknown>>;
}

export interface CrawlerKafkaTopic {
  name: string;
  topic: string;
  enabled: boolean;
  messageCount: number;
  lastProducedAt?: string;
}

export interface CrawlerStats {
  totalJobs: number;
  runningJobs: number;
  totalRuns24h: number;
  totalRecords24h: number;
  failedRecords24h: number;
  avgRatePerMinute: number;
  health: EHealthStatus;
}
