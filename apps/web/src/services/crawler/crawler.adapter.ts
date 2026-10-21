import { z } from 'zod';
import type { CrawlerJob, CrawlerRun, CrawlerStats } from '@/types/entities';

export function decodeCrawler(input: unknown): CrawlerJob {
  const v = z.object({ name: z.string(), sourceName: z.string(), description: z.string(), kafkaTopic: z.string().nullable() }).parse(input);
  return { name: v.name, source: v.sourceName, description: v.description, status: 'unknown', health: 'unknown',
    ...(v.kafkaTopic ? { kafkaTopic: v.kafkaTopic } : {}),
  };
}
export function decodeCrawlerRun(input: unknown): CrawlerRun {
  const v = z.object({ runId: z.string(), crawler: z.string(), status: z.enum(['queued','running','success','partial','failed','cancelled']),
    startedAt: z.string(), finishedAt: z.string().optional(), durationMs: z.number().optional(),
    itemsTotal: z.number().optional(), itemsSuccess: z.number().optional(), itemsFailed: z.number().optional(),
    stats: z.object({ total: z.number(), success: z.number(), failed: z.number() }).optional(), errorMessage: z.string().optional(),
  }).parse(input);
  return { runId: v.runId, name: v.crawler, status: v.status, startedAt: v.startedAt,
    ...(v.finishedAt ? { finishedAt: v.finishedAt } : {}), ...(v.durationMs !== undefined ? { durationMs: v.durationMs } : {}),
    recordsCollected: v.stats?.success ?? v.itemsSuccess, recordsFailed: v.stats?.failed ?? v.itemsFailed,
    ...(v.errorMessage ? { errorMessage: v.errorMessage } : {}),
  };
}
export function decodeCrawlerStats(input: unknown): CrawlerStats {
  const v = z.array(z.object({ crawler: z.string(), totalItems: z.number(), totalFailed: z.number() })).parse(input);
  return { totalRecords24h: v.reduce((sum, item) => sum + item.totalItems, 0), failedRecords24h: v.reduce((sum, item) => sum + item.totalFailed, 0), health: 'unknown' };
}
export function crawlerPayload(payload: { pages?: number; categories?: ReadonlyArray<string> }) {
  if ((payload.categories?.length ?? 0) > 1) throw new Error('The API accepts one category per crawler run.');
  return { maxPages: payload.pages ?? 1, ...(payload.categories?.[0] ? { category: payload.categories[0] } : {}) };
}
export function decodeCrawlerItems(input: unknown): unknown[] {
  return z.object({ items: z.array(z.unknown()) }).parse(input).items;
}
export const decodeCrawlers = (input: unknown) => z.array(z.unknown()).parse(input).map(decodeCrawler);

export function decodeCrawlerConfig(input: unknown) {
  const value = z.object({ rateLimit: z.number(), maxRetries: z.number(), timeout: z.number(), maxWorkers: z.number(), kafkaTopic: z.string().nullable(), userAgent: z.string() }).parse(input);
  return { timeoutSec: value.timeout, ratePerMinute: value.rateLimit * 60, retries: value.maxRetries, maxWorkers: value.maxWorkers, headers: { 'User-Agent': value.userAgent } };
}
export function decodeCrawlerTopic(input: unknown) {
  const value = z.object({ crawler: z.string(), kafkaTopic: z.string().nullable() }).parse(input);
  return { name: value.crawler, topic: value.kafkaTopic ?? undefined, enabled: value.kafkaTopic !== null };
}
export function decodeRunItems(input: unknown) {
  return decodeCrawlerItems(input).map((item) => {
    const value = z.object({ id: z.string(), status: z.enum(['success', 'failed', 'skipped']), payload: z.record(z.unknown()), error: z.string().optional() }).parse(item);
    return { url: value.id, status: value.status, data: value.payload, ...(value.error ? { errorMessage: value.error } : {}) };
  });
}
export function decodePreview(input: unknown) {
  return decodeCrawlerItems(input).map((item) => {
    const value = z.object({ id: z.string(), payload: z.record(z.unknown()) }).parse(item);
    const text = (key: string) => { const field = value.payload[key]; return typeof field === 'string' ? field : undefined; };
    return { url: text('url') ?? text('html_url') ?? value.id, title: text('title') ?? text('name') ?? value.id };
  });
}
