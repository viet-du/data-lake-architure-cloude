import type { KafkaCompression } from './kafka.enum';

export interface KafkaTopicConfig {
  numPartitions: number;
  replicationFactor: number;
  retentionMs?: number;
  cleanupPolicy?: 'delete' | 'compact';
  compressionType?: KafkaCompression;
  configEntries?: Array<{ name: string; value: string }>;
}

export interface KafkaTopic {
  name: string;
  partitions: number;
  replicationFactor: number;
  retentionMs: number | null;
  cleanupPolicy: string | null;
  compressionType: string | null;
  isInternal: boolean;
  createdAt?: string;
}

export interface KafkaMessage {
  partition: number;
  offset: string;
  timestamp: string;
  key: string | null;
  value: string;
  headers?: Record<string, string>;
}

export interface KafkaConsumerGroupMember {
  memberId: string;
  clientId: string;
  host: string;
  topicPartitions: Array<{ topic: string; partition: number }>;
}

export interface KafkaConsumerGroup {
  groupId: string;
  state: string;
  protocol: string;
  protocolType: string;
  members: KafkaConsumerGroupMember[];
  totalLag: number;
}

export interface KafkaLagPartition {
  topic: string;
  partition: number;
  currentOffset: string;
  endOffset: string;
  lag: number;
}

export interface KafkaBrokerInfo {
  nodeId: number;
  host: string;
  port: number;
  rack: string | null;
}

export interface KafkaClusterInfo {
  clusterId: string;
  controller: number;
  brokers: KafkaBrokerInfo[];
  topicsCount: number;
  consumerGroupsCount: number;
}

export interface KafkaStats {
  totalTopics: number;
  totalPartitions: number;
  totalConsumerGroups: number;
  totalMessagesIn: number;
  totalLag: number;
  byTopic: Array<{
    topic: string;
    partitions: number;
    endOffsetTotal: number;
    lag: number;
  }>;
}