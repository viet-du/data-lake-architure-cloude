import { z } from 'zod';

export const TableParamsSchema = z.object({
  table: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9_]+$/, 'table name must be lowercase alphanumeric + underscore'),
});

export type TTableParams = z.infer<typeof TableParamsSchema>;

export const TableListQuerySchema = z.object({
  database: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export type TTableListQuery = z.infer<typeof TableListQuerySchema>;

export const SampleQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});

export type TSampleQuery = z.infer<typeof SampleQuerySchema>;

export const TimeTravelParamsSchema = z.object({
  table: z.string().min(1),
  version: z.coerce.number().int().min(0).max(1_000_000),
});

export type TTimeTravelParams = z.infer<typeof TimeTravelParamsSchema>;

export const DiffParamsSchema = z.object({
  table: z.string().min(1),
  v1: z.coerce.number().int().min(0).max(1_000_000),
  v2: z.coerce.number().int().min(0).max(1_000_000),
});

export type TDiffParams = z.infer<typeof DiffParamsSchema>;

export const TimeTravelQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});

export type TTimeTravelQuery = z.infer<typeof TimeTravelQuerySchema>;