import { z } from 'zod';
import { CRAWLER_NAMES, CRAWLER_SINCE } from '../types';

export const CrawlerNameParamSchema = z.object({
  name: z.enum(CRAWLER_NAMES),
});

export type TCrawlerNameParam = z.infer<typeof CrawlerNameParamSchema>;

export const CrawlerRunIdParamSchema = z.object({
  name: z.enum(CRAWLER_NAMES),
  runId: z.string().min(1).max(255),
});

export type TCrawlerRunIdParam = z.infer<typeof CrawlerRunIdParamSchema>;

export const CrawlerListQuerySchema = z.object({
  status: z
    .enum(['queued', 'running', 'success', 'failed', 'partial', 'cancelled'])
    .optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type TCrawlerListQuery = z.infer<typeof CrawlerListQuerySchema>;

export const CrawlerRunsListQuerySchema = z.object({
  status: z
    .enum(['queued', 'running', 'success', 'failed', 'partial', 'cancelled'])
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type TCrawlerRunsListQuery = z.infer<typeof CrawlerRunsListQuerySchema>;

export const CrawlerRunItemsQuerySchema = z.object({
  status: z.enum(['success', 'failed', 'skipped']).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export type TCrawlerRunItemsQuery = z.infer<typeof CrawlerRunItemsQuerySchema>;

export const CrawlerRunRequestBodySchema = z.object({
  category: z.string().max(120).optional(),
  maxPages: z.coerce.number().int().min(1).max(100).default(5),
  language: z.string().max(40).optional(),
  since: z.enum(CRAWLER_SINCE).optional(),
  dryRun: z.boolean().default(false),
});

export type TCrawlerRunRequestBody = z.infer<typeof CrawlerRunRequestBodySchema>;