import { z } from 'zod';
import { KAFKA_OFFSET_RESET } from '../types';

export const ConsumerGroupParamsSchema = z.object({
  groupId: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Group ID must be alphanumeric with . _ -'),
});

export type TConsumerGroupParams = z.infer<typeof ConsumerGroupParamsSchema>;

export const ConsumerGroupListQuerySchema = z.object({
  state: z
    .enum(['Stable', 'PreparingRebalance', 'CompletingRebalance', 'Empty', 'Dead'])
    .optional(),
  pattern: z.string().optional(),
});

export type TConsumerGroupListQuery = z.infer<typeof ConsumerGroupListQuerySchema>;

export const ConsumerGroupLagQuerySchema = z.object({
  topic: z.string().min(1).max(249).optional(),
});

export type TConsumerGroupLagQuery = z.infer<typeof ConsumerGroupLagQuerySchema>;

export const ResetOffsetBodySchema = z.object({
  reset: z.enum(KAFKA_OFFSET_RESET).default('earliest'),
  topic: z.string().min(1).max(249),
  offset: z.coerce.number().int().min(0).optional(),
  partitions: z.array(z.coerce.number().int().min(0)).optional(),
});

export type TResetOffsetBody = z.infer<typeof ResetOffsetBodySchema>;