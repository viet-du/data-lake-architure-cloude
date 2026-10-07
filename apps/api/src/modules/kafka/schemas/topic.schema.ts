import { z } from 'zod';
import { KAFKA_COMPRESSION } from '../types';

export const TopicNameParamSchema = z.object({
  topic: z
    .string()
    .min(1)
    .max(249)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Topic name must be alphanumeric with . _ -'),
});

export type TTopicNameParam = z.infer<typeof TopicNameParamSchema>;

export const TopicListQuerySchema = z.object({
  internal: z.coerce.boolean().default(false),
  pattern: z.string().optional(),
});

export type TTopicListQuery = z.infer<typeof TopicListQuerySchema>;

export const CreateTopicBodySchema = z.object({
  name: z
    .string()
    .min(1)
    .max(249)
    .regex(/^[a-zA-Z0-9._-]+$/),
  numPartitions: z.coerce.number().int().min(1).max(1000).default(1),
  replicationFactor: z.coerce.number().int().min(1).max(10).default(1),
  retentionMs: z.coerce.number().int().min(60_000).optional(),
  cleanupPolicy: z.enum(['delete', 'compact']).optional(),
  compressionType: z.enum(KAFKA_COMPRESSION).optional(),
  configEntries: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        value: z.string().min(1).max(255),
      }),
    )
    .optional(),
});

export type TCreateTopicBody = z.infer<typeof CreateTopicBodySchema>;

export const SampleMessagesQuerySchema = z.object({
  partition: z.coerce.number().int().min(0).optional(),
  fromOffset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  timeoutMs: z.coerce.number().int().min(100).max(60_000).default(5000),
});

export type TSampleMessagesQuery = z.infer<typeof SampleMessagesQuerySchema>;

export const ProduceMessageBodySchema = z.object({
  key: z.string().max(1024).optional(),
  value: z.string().min(1),
  headers: z.record(z.string().min(1).max(255), z.string().max(2048)).optional(),
  partition: z.coerce.number().int().min(0).optional(),
});

export type TProduceMessageBody = z.infer<typeof ProduceMessageBodySchema>;

export const ProduceBatchBodySchema = z.object({
  messages: z
    .array(
      z.object({
        key: z.string().max(1024).optional(),
        value: z.string().min(1),
        headers: z.record(z.string().min(1).max(255), z.string().max(2048)).optional(),
        partition: z.coerce.number().int().min(0).optional(),
      }),
    )
    .min(1)
    .max(1000),
});

export type TProduceBatchBody = z.infer<typeof ProduceBatchBodySchema>;