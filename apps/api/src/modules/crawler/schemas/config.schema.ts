import { z } from 'zod';

export const CrawlerConfigBodySchema = z.object({
  rateLimit: z.number().min(0.1).max(60).default(1.0),
  maxRetries: z.number().int().min(0).max(10).default(3),
  timeout: z.number().int().min(5).max(300).default(30),
  maxWorkers: z.number().int().min(1).max(32).default(8),
  kafkaTopic: z.string().min(1).max(120).nullable().default(null),
  userAgent: z.string().min(1).max(255).default('LakehouseCrawler/1.0'),
});

export type TCrawlerConfigBody = z.infer<typeof CrawlerConfigBodySchema>;

export const CrawlerPreviewQuerySchema = z.object({
  category: z.string().max(120).optional(),
  language: z.string().max(40).optional(),
  maxItems: z.coerce.number().int().min(1).max(20).default(3),
});

export type TCrawlerPreviewQuery = z.infer<typeof CrawlerPreviewQuerySchema>;