import { z } from 'zod';
import type { KafkaTopic, KafkaConsumerGroup, KafkaStats, KafkaCluster } from '@/types/entities';

export function decodeTopic(input: unknown): KafkaTopic {
  const v = z.object({ name: z.string(), partitions: z.number(), replicationFactor: z.number(), retentionMs: z.number().nullable() }).parse(input);
  return { ...v, status: 'unknown' };
}
export function decodeGroup(input: unknown): KafkaConsumerGroup {
  const v = z.object({ groupId: z.string(), state: z.enum(['Stable','PreparingRebalance','CompletingRebalance','Empty','Dead']), protocol: z.string(), totalLag: z.number(),
    members: z.array(z.object({ topicPartitions: z.array(z.object({ topic: z.string(), partition: z.number() })) })),
  }).parse(input);
  return { ...v, members: v.members.length, topics: [...new Set(v.members.flatMap((m) => m.topicPartitions.map((p) => p.topic)))] };
}
export function decodeKafkaStats(input: unknown): KafkaStats {
  const v = z.object({ totalTopics: z.number(), totalPartitions: z.number(), totalConsumerGroups: z.number(), totalLag: z.number() }).parse(input);
  return { topics: v.totalTopics, totalPartitions: v.totalPartitions, consumerGroups: v.totalConsumerGroups, totalLag: v.totalLag };
}
export function decodeCluster(input: unknown): KafkaCluster {
  const v = z.object({ clusterId: z.string(), controller: z.number(), brokers: z.array(z.unknown()), topicsCount: z.number(), consumerGroupsCount: z.number() }).parse(input);
  return { clusterId: v.clusterId, controllerId: v.controller, brokerCount: v.brokers.length, topics: v.topicsCount, consumerGroups: v.consumerGroupsCount };
}
export function decodeTopicNames(input: unknown): string[] {
  return z.object({ topics: z.array(z.string()), count: z.number() }).parse(input).topics;
}
export function decodeGroupIds(input: unknown): string[] {
  return z.object({ groups: z.array(z.object({ groupId: z.string() })), count: z.number() }).parse(input).groups.map((g) => g.groupId);
}

export function decodeMessages(input: unknown) {
  return z.object({ messages: z.array(z.object({
    partition: z.number(), offset: z.string(), timestamp: z.string(), key: z.string().nullable(), value: z.string(), headers: z.record(z.string()).optional(),
  })) }).parse(input).messages.map((message) => ({ ...message, key: message.key ?? undefined }));
}
export function decodeProduce(input: unknown) {
  const value = z.object({ topic: z.string(), partition: z.number(), offset: z.string(), producedCount: z.number() }).parse(input);
  return { ...value, produced: value.producedCount };
}
export function decodeLag(input: unknown) {
  const value = z.object({ groupId: z.string(), partitions: z.array(z.object({ topic: z.string(), partition: z.number(), currentOffset: z.string(), endOffset: z.string(), lag: z.number() })) }).parse(input);
  return value.partitions.map((partition) => ({ ...partition, groupId: value.groupId, logEndOffset: partition.endOffset }));
}
