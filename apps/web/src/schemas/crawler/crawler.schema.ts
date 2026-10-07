import { z } from 'zod';
import { apiResponseSchema, healthStatusSchema } from '../commons.schema';

export const crawlerStatusSchema = z.enum(['idle', 'running', 'paused', 'completed', 'failed']);
export const crawlerRunStatusSchema = z.enum(['queued', 'running', 'success', 'failed', 'cancelled']);
export const crawlerRunItemStatusSchema = z.enum(['success', 'failed', 'skipped']);
export const crawlerTriggeredBySchema = z.enum(['manual', 'schedule', 'api']);

export const crawlerJobSchema = z.object({
  name: z.string().min(1),
  source: z.string(),
  category: z.string(),
  status: crawlerStatusSchema,
  ratePerMinute: z.number().nonnegative(),
  maxWorkers: z.number().int().nonnegative(),
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  pagesScraped: z.number().int().nonnegative(),
  recordsCollected: z.number().int().nonnegative(),
  recordsFailed: z.number().int().nonnegative(),
  kafkaTopic: z.string().optional(),
  errorMessage: z.string().optional(),
  health: healthStatusSchema,
});

export const crawlerConfigSchema = z.object({
  name: z.string().min(1),
  source: z.string(),
  category: z.string(),
  baseUrl: z.string().url(),
  ratePerMinute: z.number().int().nonnegative(),
  maxWorkers: z.number().int().nonnegative(),
  timeoutSec: z.number().int().nonnegative(),
  headers: z.record(z.string()),
  proxyEnabled: z.boolean(),
  retries: z.number().int().nonnegative(),
});

export const crawlerPreviewItemSchema = z.object({
  url: z.string(),
  title: z.string(),
  price: z.number().optional(),
  sku: z.string().optional(),
  category: z.string().optional(),
});

export const crawlerRunSchema = z.object({
  runId: z.string(),
  name: z.string(),
  status: crawlerRunStatusSchema,
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  pagesScraped: z.number().int().nonnegative(),
  recordsCollected: z.number().int().nonnegative(),
  recordsFailed: z.number().int().nonnegative(),
  triggeredBy: crawlerTriggeredBySchema,
  errorMessage: z.string().optional(),
});

export const crawlerRunItemSchema = z.object({
  url: z.string(),
  status: crawlerRunItemStatusSchema,
  attempts: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  errorMessage: z.string().optional(),
  data: z.record(z.unknown()).optional(),
});

export const crawlerKafkaTopicSchema = z.object({
  name: z.string(),
  topic: z.string(),
  enabled: z.boolean(),
  messageCount: z.number().int().nonnegative(),
  lastProducedAt: z.string().optional(),
});

export const crawlerStatsSchema = z.object({
  totalJobs: z.number().int().nonnegative(),
  runningJobs: z.number().int().nonnegative(),
  totalRuns24h: z.number().int().nonnegative(),
  totalRecords24h: z.number().int().nonnegative(),
  failedRecords24h: z.number().int().nonnegative(),
  avgRatePerMinute: z.number().nonnegative(),
  health: healthStatusSchema,
});

export const runJobPayloadSchema = z.object({
  pages: z.number().int().min(1).max(1000).optional(),
  categories: z.array(z.string()).optional(),
  async: z.boolean().optional(),
  value: z.string().min(1).optional(),
});

export const crawlerJobsResponseSchema = apiResponseSchema(z.array(crawlerJobSchema));
export const crawlerJobResponseSchema = apiResponseSchema(crawlerJobSchema);
export const crawlerConfigResponseSchema = apiResponseSchema(crawlerConfigSchema);
export const crawlerPreviewResponseSchema = apiResponseSchema(z.array(crawlerPreviewItemSchema));
export const crawlerRunsResponseSchema = apiResponseSchema(z.array(crawlerRunSchema));
export const crawlerRunResponseSchema = apiResponseSchema(crawlerRunSchema);
export const crawlerRunItemsResponseSchema = apiResponseSchema(z.array(crawlerRunItemSchema));
export const crawlerKafkaTopicResponseSchema = apiResponseSchema(crawlerKafkaTopicSchema);
export const crawlerStatsResponseSchema = apiResponseSchema(crawlerStatsSchema);
