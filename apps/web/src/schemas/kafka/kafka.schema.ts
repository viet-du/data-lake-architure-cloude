import { z } from 'zod';
import { apiResponseSchema, healthStatusSchema } from '../commons.schema';

export const consumerGroupStateSchema = z.enum([
  'Stable',
  'PreparingRebalance',
  'CompletingRebalance',
  'Empty',
  'Dead',
]);

export const kafkaTopicSchema = z.object({
  name: z.string().min(1),
  partitions: z.number().int().nonnegative(),
  replicationFactor: z.number().int().nonnegative(),
  retentionMs: z.number().int().nonnegative(),
  messagesPerSec: z.number().nonnegative(),
  consumerGroups: z.number().int().nonnegative(),
  lag: z.number().int().nonnegative(),
  status: healthStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  config: z.record(z.string()).optional(),
});

export const kafkaMessageSchema = z.object({
  partition: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  timestamp: z.string(),
  key: z.string().optional(),
  value: z.string().min(1),
  headers: z.record(z.string()).optional(),
});

export const kafkaProducePayloadSchema = z.object({
  key: z.string().optional(),
  value: z.string().min(1),
  headers: z.record(z.string()).optional(),
  partition: z.number().int().nonnegative().optional(),
});

export const kafkaProduceResultSchema = z.object({
  topic: z.string(),
  partition: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  timestamp: z.string(),
});

export const kafkaProduceBatchPayloadSchema = z.object({
  messages: z.array(kafkaProducePayloadSchema).min(1).max(500),
});

export const kafkaProduceBatchResultSchema = z.object({
  topic: z.string(),
  produced: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  results: z.array(kafkaProduceResultSchema),
});

export const kafkaConsumerGroupSchema = z.object({
  groupId: z.string(),
  state: consumerGroupStateSchema,
  protocol: z.string(),
  members: z.number().int().nonnegative(),
  totalLag: z.number().int().nonnegative(),
  topics: z.array(z.string()),
});

export const kafkaConsumerGroupLagSchema = z.object({
  groupId: z.string(),
  topic: z.string(),
  partition: z.number().int().nonnegative(),
  currentOffset: z.number().int().nonnegative(),
  logEndOffset: z.number().int().nonnegative(),
  lag: z.number().int().nonnegative(),
});

export const kafkaClusterSchema = z.object({
  brokerCount: z.number().int().nonnegative(),
  controllerId: z.number().int().nonnegative(),
  clusterId: z.string(),
  topics: z.number().int().nonnegative(),
  consumerGroups: z.number().int().nonnegative(),
  totalMessages: z.number().int().nonnegative(),
  version: z.string(),
});

export const kafkaStatsSchema = z.object({
  topics: z.number().int().nonnegative(),
  consumerGroups: z.number().int().nonnegative(),
  totalPartitions: z.number().int().nonnegative(),
  totalMessagesPerSec: z.number().nonnegative(),
  totalLag: z.number().int().nonnegative(),
});

export const listMessagesParamsSchema = z.object({
  partition: z.number().int().nonnegative().optional(),
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().min(1).max(500).optional(),
  fromTimestamp: z.string().optional(),
});

export const resetOffsetPayloadSchema = z.object({
  topic: z.string().min(1),
  partition: z.number().int().nonnegative(),
  offset: z.union([z.literal('earliest'), z.literal('latest'), z.number().int().nonnegative()]),
});

export const kafkaTopicsResponseSchema = apiResponseSchema(z.array(kafkaTopicSchema));
export const kafkaTopicResponseSchema = apiResponseSchema(kafkaTopicSchema);
export const kafkaMessagesResponseSchema = apiResponseSchema(z.array(kafkaMessageSchema));
export const kafkaProduceResponseSchema = apiResponseSchema(kafkaProduceResultSchema);
export const kafkaProduceBatchResponseSchema = apiResponseSchema(kafkaProduceBatchResultSchema);
export const kafkaConsumerGroupsResponseSchema = apiResponseSchema(z.array(kafkaConsumerGroupSchema));
export const kafkaConsumerGroupResponseSchema = apiResponseSchema(kafkaConsumerGroupSchema);
export const kafkaConsumerGroupLagResponseSchema = apiResponseSchema(z.array(kafkaConsumerGroupLagSchema));
export const kafkaClusterResponseSchema = apiResponseSchema(kafkaClusterSchema);
export const kafkaStatsResponseSchema = apiResponseSchema(kafkaStatsSchema);
