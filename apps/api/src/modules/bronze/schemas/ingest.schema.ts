import { z } from 'zod';

export const IngestCsvBodySchema = z.object({
  database: z.string().min(1).max(64),
  table: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9_]+$/, 'table name must be lowercase alphanumeric + underscore'),
  source: z.string().min(1).max(2048),
  partition: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  options: z
    .object({
      header: z.boolean().default(true),
      delimiter: z.string().max(4).default(','),
      encoding: z.string().default('utf-8'),
    })
    .default({ header: true, delimiter: ',', encoding: 'utf-8' }),
});

export type TIngestCsvBody = z.infer<typeof IngestCsvBodySchema>;

export const IngestJsonBodySchema = z.object({
  database: z.string().min(1).max(64),
  table: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9_]+$/),
  source: z.string().min(1).max(2048),
  partition: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  options: z
    .object({
      format: z.enum(['json', 'jsonl', 'ndjson']).default('jsonl'),
      compression: z.enum(['none', 'gzip', 'zstd']).default('none'),
    })
    .default({ format: 'jsonl', compression: 'none' }),
});

export type TIngestJsonBody = z.infer<typeof IngestJsonBodySchema>;

export const IngestStreamBodySchema = z.object({
  database: z.string().min(1).max(64),
  table: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9_]+$/),
  consumerGroup: z.string().min(1).max(255).default('bronze-ingestor'),
  maxMessages: z.coerce.number().int().min(1).max(1_000_000).default(10_000),
  timeoutMs: z.coerce.number().int().min(1000).max(600_000).default(60_000),
});

export type TIngestStreamBody = z.infer<typeof IngestStreamBodySchema>;

export const IngestStreamParamsSchema = z.object({
  topic: z.string().min(1).max(255),
});

export type TIngestStreamParams = z.infer<typeof IngestStreamParamsSchema>;