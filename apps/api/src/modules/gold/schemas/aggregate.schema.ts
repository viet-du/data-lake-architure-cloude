import { z } from 'zod';
import { GOLD_AGGREGATE_KINDS } from '../types';

export const AggregateBodySchema = z.object({
  kind: z.enum(GOLD_AGGREGATE_KINDS).default('full'),
  sourceTables: z
    .array(
      z
        .string()
        .min(1)
        .max(120)
        .regex(/^[a-z0-9_]+$/),
    )
    .min(1)
    .max(20)
    .optional(),
  partition: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  qualityChecks: z.boolean().default(true),
});

export type TAggregateBody = z.infer<typeof AggregateBodySchema>;

export const AggregateAllBodySchema = z.object({
  kind: z.enum(GOLD_AGGREGATE_KINDS).default('full'),
  parallel: z.coerce.number().int().min(1).max(16).default(4),
  qualityChecks: z.boolean().default(true),
});

export type TAggregateAllBody = z.infer<typeof AggregateAllBodySchema>;

export const RefreshBodySchema = z.object({
  partition: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  preserveHistory: z.boolean().default(false),
});

export type TRefreshBody = z.infer<typeof RefreshBodySchema>;