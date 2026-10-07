import { listCrawlerMeta, getCrawler } from '../adapters';
import { CrawlerConfigRepository } from '../repositories';
import { CrawlerQueue } from '../queues/crawler.queue';
import { CrawlerRunRepository } from '../repositories';
import { processCrawl } from '../workers';
import { randomUUID } from 'crypto';
import { logger } from '@/lib/logger';
import type {
  CrawlerName,
  CrawlerMeta,
  CrawlerConfig,
  CrawlerRun,
  CrawlerRunSummary,
  CrawlerItem,
  CrawlerStats,
  CrawlerRunRequest,
} from '../types';
import type {
  TCrawlerNameParam,
  TCrawlerRunIdParam,
  TCrawlerRunsListQuery,
  TCrawlerRunItemsQuery,
  TCrawlerRunRequestBody,
  TCrawlerConfigBody,
  TCrawlerPreviewQuery,
} from '../schemas';

function generateRunId(crawler: CrawlerName): string {
  return `run-${crawler}-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

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

export const CrawlerService = {
  list(): CrawlerMeta[] {
    return listCrawlerMeta();
  },

  async getMeta(name: TCrawlerNameParam['name']): Promise<CrawlerMeta> {
    const meta = listCrawlerMeta().find((c) => c.name === name);
    if (!meta) throw new Error(`Unknown crawler: ${name}`);
    return meta;
  },

  async getKafkaTopic(name: TCrawlerNameParam['name']): Promise<{ crawler: CrawlerName; kafkaTopic: string | null }> {
    const meta = await this.getMeta(name);
    return { crawler: meta.name, kafkaTopic: meta.kafkaTopic };
  },

  async getConfig(name: TCrawlerNameParam['name']): Promise<CrawlerConfig> {
    return CrawlerConfigRepository.get(name);
  },

  async updateConfig(name: TCrawlerNameParam['name'], body: TCrawlerConfigBody): Promise<CrawlerConfig> {
    return CrawlerConfigRepository.update(name, body);
  },

  async runSync(
    name: TCrawlerNameParam['name'],
    body: TCrawlerRunRequestBody,
    requestedBy?: string,
  ): Promise<CrawlerRun> {
    const request: CrawlerRunRequest = {
      maxPages: body.maxPages,
      dryRun: body.dryRun,
      ...(body.category ? { category: body.category } : {}),
      ...(body.language ? { language: body.language } : {}),
      ...(body.since ? { since: body.since } : {}),
    };
    const runId = generateRunId(name);
    const created = await CrawlerRunRepository.create({
      runId,
      crawler: name,
      request,
      ...(requestedBy ? { requestedBy } : {}),
    });
    logger.info({ runId, crawler: name, request }, 'Crawler run (sync) started');
    await processCrawl({
      jobId: runId,
      runId,
      crawler: name,
      request,
      ...(requestedBy ? { requestedBy } : {}),
      startedAt: created.startedAt,
    });
    const fresh = await CrawlerRunRepository.findByRunId(name, runId);
    if (!fresh) throw new Error(`Run ${runId} disappeared`);
    return fresh;
  },

  async runAsync(
    name: TCrawlerNameParam['name'],
    body: TCrawlerRunRequestBody,
    requestedBy?: string,
  ): Promise<{ runId: string; jobId: string | null; status: 'queued' }> {
    const request: CrawlerRunRequest = {
      maxPages: body.maxPages,
      dryRun: body.dryRun,
      ...(body.category ? { category: body.category } : {}),
      ...(body.language ? { language: body.language } : {}),
      ...(body.since ? { since: body.since } : {}),
    };
    const runId = generateRunId(name);
    const created = await CrawlerRunRepository.create({
      runId,
      crawler: name,
      request,
      ...(requestedBy ? { requestedBy } : {}),
    });
    const jobId = await CrawlerQueue.add({
      jobId: runId,
      runId,
      crawler: name,
      request,
      ...(requestedBy ? { requestedBy } : {}),
      startedAt: created.startedAt,
    });
    logger.info({ runId, crawler: name, jobId, request }, 'Crawler run (async) enqueued');
    return { runId, jobId, status: 'queued' };
  },

  async stopRun(params: TCrawlerRunIdParam): Promise<{ runId: string; cancelled: boolean }> {
    const run = await CrawlerRunRepository.findByRunId(params.name, params.runId);
    if (!run) return { runId: params.runId, cancelled: false };
    await CrawlerQueue.cancel(params.runId);
    await CrawlerRunRepository.update(params.runId, {
      status: 'cancelled',
      finishedAt: new Date().toISOString(),
    });
    return { runId: params.runId, cancelled: true };
  },

  async listRuns(
    params: TCrawlerNameParam,
    query: TCrawlerRunsListQuery,
  ): Promise<{ total: number; items: CrawlerRunSummary[] }> {
    return CrawlerRunRepository.list(params.name, {
      limit: query.limit,
      offset: query.offset,
      ...(query.status ? { status: query.status } : {}),
    });
  },

  async getRun(params: TCrawlerRunIdParam): Promise<CrawlerRun> {
    const run = await CrawlerRunRepository.findByRunId(params.name, params.runId);
    if (!run) throw new Error(`Run ${params.runId} not found`);
    return run;
  },

  async listRunItems(
    params: TCrawlerRunIdParam,
    query: TCrawlerRunItemsQuery,
  ): Promise<{ total: number; items: CrawlerItem[] }> {
    return CrawlerRunRepository.listItems(params.name, params.runId, {
      limit: query.limit,
      offset: query.offset,
      ...(query.status ? { status: query.status } : {}),
    });
  },

  async preview(
    name: TCrawlerNameParam['name'],
    query: TCrawlerPreviewQuery,
  ): Promise<{ crawler: CrawlerName; dryRun: true; items: CrawlerItem[]; stats: { total: number; success: number; failed: number; skipped: number } }> {
    const crawler = getCrawler(name);
    const config = await CrawlerConfigRepository.get(name);
    const items = await crawler.crawl({
      config,
      request: { maxPages: query.maxItems, dryRun: true },
      dryRun: true,
    });
    const preview = items.slice(0, query.maxItems);
    return {
      crawler: name,
      dryRun: true,
      items: preview,
      stats: statsFromItems(preview),
    };
  },

  async stats(): Promise<CrawlerStats[]> {
    const rows = await CrawlerRunRepository.statsByCrawler();
    return rows.map((r) => ({
      crawler: r._id,
      totalRuns: r.totalRuns,
      successRuns: r.successRuns,
      failedRuns: r.failedRuns,
      cancelledRuns: r.cancelledRuns,
      totalItems: r.totalItems,
      totalSuccess: r.totalSuccess,
      totalFailed: r.totalFailed,
      totalSkipped: r.totalSkipped,
      ...(r.lastRunAt ? { lastRunAt: r.lastRunAt } : {}),
      ...(r.lastSuccessAt ? { lastSuccessAt: r.lastSuccessAt } : {}),
    }));
  },
};