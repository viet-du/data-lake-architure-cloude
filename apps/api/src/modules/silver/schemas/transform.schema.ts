import { z } from 'zod';
import { SILVER_TRANSFORM_KINDS } from '../types';

export const TransformBodySchema = z.object({
  kind: z.enum(SILVER_TRANSFORM_KINDS).default('full'),
  sourceTable: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9_]+$/)
    .optional(),
  partition: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  qualityChecks: z.boolean().default(true),
});

export type TTransformBody = z.infer<typeof TransformBodySchema>;

export const TransformAllBodySchema = z.object({
  kind: z.enum(SILVER_TRANSFORM_KINDS).default('full'),
  parallel: z.coerce.number().int().min(1).max(16).default(4),
  qualityChecks: z.boolean().default(true),
});

export type TTransformAllBody = z.infer<typeof TransformAllBodySchema>;

export const RefreshBodySchema = z.object({
  partition: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  preserveHistory: z.boolean().default(false),
});

export type TRefreshBody = z.infer<typeof RefreshBodySchema>;