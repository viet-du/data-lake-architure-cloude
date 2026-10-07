import type { EHealthStatus } from '@/types/commons';

export interface KafkaTopic {
  name: string;
  partitions: number;
  replicationFactor: number;
  retentionMs: number;
  messagesPerSec: number;
  consumerGroups: number;
  lag: number;
  status: EHealthStatus;
  createdAt: string;
  updatedAt: string;
  config?: Readonly<Record<string, string>>;
}

export interface KafkaMessage {
  partition: number;
  offset: number;
  timestamp: string;
  key?: string;
  value: string;
  headers?: Readonly<Record<string, string>>;
}

export interface KafkaProducePayload {
  key?: string;
  value: string;
  headers?: Readonly<Record<string, string>>;
  partition?: number;
}

export interface KafkaProduceResult {
  topic: string;
  partition: number;
  offset: number;
  timestamp: string;
}

export interface KafkaProduceBatchPayload {
  messages: ReadonlyArray<KafkaProducePayload>;
}

export interface KafkaProduceBatchResult {
  topic: string;
  produced: number;
  failed: number;
  results: ReadonlyArray<KafkaProduceResult>;
}

export interface KafkaConsumerGroup {
  groupId: string;
  state: 'Stable' | 'PreparingRebalance' | 'CompletingRebalance' | 'Empty' | 'Dead';
  protocol: string;
  members: number;
  totalLag: number;
  topics: ReadonlyArray<string>;
}

export interface KafkaConsumerGroupLag {
  groupId: string;
  topic: string;
  partition: number;
  currentOffset: number;
  logEndOffset: number;
  lag: number;
}

export interface KafkaCluster {
  brokerCount: number;
  controllerId: number;
  clusterId: string;
  topics: number;
  consumerGroups: number;
  totalMessages: number;
  version: string;
}

export interface KafkaStats {
  topics: number;
  consumerGroups: number;
  totalPartitions: number;
  totalMessagesPerSec: number;
  totalLag: number;
}
