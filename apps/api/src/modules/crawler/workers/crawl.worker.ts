import { Worker, type Job } from 'bullmq';
import { getQueueConnection } from '@/lib/infra/queue';
import { getCrawler } from '../adapters';
import { CrawlerRunRepository, CrawlerConfigRepository } from '../repositories';
import { CRAWLER_QUEUE_NAME, type CrawlerJobPayload } from '../queues/crawler.queue';
import { logger } from '@/lib/logger';
import type { CrawlerItem, CrawlerRunStatus } from '../types';

function statsFromItems(items: CrawlerItem[]): {
  total: number;
  success: number;
  failed: number;
  skipped: number;
} {
  let success = 0;
  let failed = 0;
  let skipped = 0;
  for (const i of items) {
    if (i.status === 'success') success++;
    else if (i.status === 'failed') failed++;
    else skipped++;
  }
  return { total: items.length, success, failed, skipped };
}

function finalizeStatus(stats: { success: number; failed: number; total: number }): CrawlerRunStatus {
  if (stats.total === 0) return 'failed';
  if (stats.failed === 0) return 'success';
  if (stats.success === 0) return 'failed';
  return 'partial';
}

export async function processCrawl(payload: CrawlerJobPayload): Promise<CrawlerItem[]> {
  logger.info(
    { runId: payload.runId, crawler: payload.crawler, request: payload.request },
    'Crawler run started',
  );
  await CrawlerRunRepository.update(payload.runId, { status: 'running' });
  const config = await CrawlerConfigRepository.get(payload.crawler);
  const crawler = getCrawler(payload.crawler);
  try {
    const items = await crawler.crawl({
      config,
      request: payload.request,
      dryRun: payload.request.dryRun,
    });
    const stats = statsFromItems(items);
    const status = payload.request.dryRun ? 'success' : finalizeStatus(stats);
    const finishedAt = new Date().toISOString();
    const startedAt = new Date(payload.startedAt).getTime();
    await CrawlerRunRepository.update(payload.runId, {
      status,
      items,
      stats,
      finishedAt,
      durationMs: Date.now() - startedAt,
    });
    logger.info(
      { runId: payload.runId, crawler: payload.crawler, stats, status },
      'Crawler run finished',
    );
    return items;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const finishedAt = new Date().toISOString();
    const startedAt = new Date(payload.startedAt).getTime();
    await CrawlerRunRepository.update(payload.runId, {
      status: 'failed',
      errorMessage: msg,
      finishedAt,
      durationMs: Date.now() - startedAt,
    });
    throw err;
  }
}

export const CrawlerRunWorker = {
  start(): Worker<CrawlerJobPayload> {
    return new Worker<CrawlerJobPayload>(
      CRAWLER_QUEUE_NAME,
      async (job: Job<CrawlerJobPayload>) => {
        return processCrawl(job.data);
      },
      { connection: getQueueConnection(), concurrency: 4 },
    );
  },
};