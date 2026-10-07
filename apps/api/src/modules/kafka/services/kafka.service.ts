import {
  KafkaTopicRepository,
  KafkaMessageRepository,
  KafkaConsumerGroupRepository,
  KafkaClusterRepository,
  KafkaClient,
} from '../repositories';
import type {
  KafkaTopic,
  KafkaMessage,
  KafkaConsumerGroup,
  KafkaLagPartition,
  KafkaClusterInfo,
  KafkaStats,
} from '../types';
import { AppError } from '@/errors';

export const KafkaTopicService = {
  async list(query: { internal?: boolean; pattern?: string }): Promise<{ topics: string[]; count: number }> {
    const topics = await KafkaTopicRepository.listTopics(query);
    return { topics, count: topics.length };
  },

  async show(topic: string): Promise<KafkaTopic> {
    try {
      return await KafkaTopicRepository.describeTopic(topic);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('not found') || msg.includes('does not exist')) {
        throw new AppError(404, 'TOPIC_NOT_FOUND', `Topic not found: ${topic}`);
      }
      throw err;
    }
  },

  async create(input: {
    name: string;
    numPartitions: number;
    replicationFactor: number;
    retentionMs?: number;
    cleanupPolicy?: 'delete' | 'compact';
    compressionType?: 'none' | 'gzip' | 'snappy' | 'lz4' | 'zstd';
    configEntries?: Array<{ name: string; value: string }>;
  }): Promise<{ name: string; numPartitions: number; replicationFactor: number; created: boolean }> {
    const existing = await KafkaTopicRepository.listTopics({ internal: true });
    if (existing.includes(input.name)) {
      throw new AppError(409, 'TOPIC_EXISTS', `Topic already exists: ${input.name}`);
    }
    await KafkaTopicRepository.createTopic(input);
    return {
      name: input.name,
      numPartitions: input.numPartitions,
      replicationFactor: input.replicationFactor,
      created: true,
    };
  },

  async remove(topic: string): Promise<{ topic: string; deleted: boolean }> {
    await KafkaTopicRepository.deleteTopic(topic);
    return { topic, deleted: true };
  },
};

export const KafkaMessageService = {
  async sample(
    topic: string,
    query: { partition?: number; fromOffset: number; limit: number; timeoutMs: number },
  ): Promise<{ topic: string; messages: KafkaMessage[]; count: number }> {
    const messages = await KafkaMessageRepository.sampleMessages(topic, query);
    return { topic, messages, count: messages.length };
  },

  async produce(
    topic: string,
    body: { key?: string; value: string; headers?: Record<string, string>; partition?: number },
  ): Promise<{ topic: string; producedCount: number; partition: number; offset: string }> {
    const result = await KafkaMessageRepository.produce(topic, [
      {
        ...(body.key !== undefined ? { key: body.key } : {}),
        value: body.value,
        ...(body.headers ? { headers: body.headers } : {}),
        ...(body.partition !== undefined ? { partition: body.partition } : {}),
      },
    ]);
    return { topic, ...result };
  },

  async produceBatch(
    topic: string,
    messages: Array<{
      key?: string;
      value: string;
      headers?: Record<string, string>;
      partition?: number;
    }>,
  ): Promise<{ topic: string; producedCount: number; partition: number; offset: string }> {
    const result = await KafkaMessageRepository.produce(topic, messages);
    return { topic, ...result };
  },
};

export const KafkaConsumerGroupService = {
  async list(query: { state?: string; pattern?: string }): Promise<{
    groups: Array<{ groupId: string; state: string; protocol: string }>;
    count: number;
  }> {
    const groups = await KafkaConsumerGroupRepository.listGroups(query);
    return { groups, count: groups.length };
  },

  async show(groupId: string): Promise<KafkaConsumerGroup> {
    try {
      return await KafkaConsumerGroupRepository.describeGroup(groupId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('does not exist')) {
        throw new AppError(404, 'GROUP_NOT_FOUND', `Consumer group not found: ${groupId}`);
      }
      throw err;
    }
  },

  async remove(groupId: string): Promise<{ groupId: string; deleted: boolean }> {
    try {
      await KafkaConsumerGroupRepository.deleteGroup(groupId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('does not exist')) {
        throw new AppError(404, 'GROUP_NOT_FOUND', `Consumer group not found: ${groupId}`);
      }
      throw err;
    }
    return { groupId, deleted: true };
  },

  async lag(groupId: string, topic?: string): Promise<{
    groupId: string;
    partitions: KafkaLagPartition[];
    totalLag: number;
  }> {
    const partitions = await KafkaConsumerGroupRepository.lagForGroup(groupId, topic);
    return {
      groupId,
      partitions,
      totalLag: partitions.reduce((sum, p) => sum + p.lag, 0),
    };
  },

  async resetOffset(
    groupId: string,
    body: { reset: 'earliest' | 'latest' | 'specific'; topic: string; offset?: number; partitions?: number[] },
  ): Promise<{
    groupId: string;
    topic: string;
    reset: string;
    partitions?: number[];
    offset?: number;
  }> {
    if (body.reset === 'specific' && (body.offset === undefined || !body.partitions || body.partitions.length === 0)) {
      throw new AppError(400, 'INVALID_RESET_PAYLOAD', 'offset and partitions required for specific reset');
    }
    await KafkaConsumerGroupRepository.resetOffset(groupId, body);
    return {
      groupId,
      topic: body.topic,
      reset: body.reset,
      ...(body.partitions ? { partitions: body.partitions } : {}),
      ...(body.offset !== undefined ? { offset: body.offset } : {}),
    };
  },
};

export const KafkaClusterService = {
  async info(): Promise<KafkaClusterInfo> {
    return KafkaClusterRepository.clusterInfo();
  },

  async stats(): Promise<KafkaStats> {
    return KafkaClusterRepository.stats();
  },
};

export const KafkaHealthService = {
  async health(): Promise<{ connected: boolean; brokers: string[] }> {
    try {
      await KafkaClient.admin();
      return { connected: true, brokers: KafkaClient.getBrokers() };
    } catch {
      return { connected: false, brokers: KafkaClient.getBrokers() };
    }
  },
};