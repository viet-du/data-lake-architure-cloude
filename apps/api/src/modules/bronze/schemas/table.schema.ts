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

export const PartitionDateParamsSchema = z.object({
  table: z.string().min(1),
  date: z
    .string()
    .min(1)
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
});

export type TPartitionDateParams = z.infer<typeof PartitionDateParamsSchema>;

export const VacuumBodySchema = z.object({
  retentionDays: z.coerce.number().int().min(0).max(365).default(7),
  dryRun: z.boolean().default(false),
});

export type TVacuumBody = z.infer<typeof VacuumBodySchema>;

export const SampleQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});

export type TSampleQuery = z.infer<typeof SampleQuerySchema>;