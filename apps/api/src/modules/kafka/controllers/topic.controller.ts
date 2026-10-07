import {
  KafkaTopicService,
  KafkaMessageService,
} from '../services/kafka.service';
import type {
  KafkaTopic,
  KafkaMessage,
} from '../types';
import type {
  TTopicNameParam,
  TTopicListQuery,
  TCreateTopicBody,
  TSampleMessagesQuery,
  TProduceMessageBody,
  TProduceBatchBody,
} from '../schemas';

export const KafkaTopicController = {
  async list(query: TTopicListQuery): Promise<{ topics: string[]; count: number }> {
    return KafkaTopicService.list({
      ...(query.internal !== undefined ? { internal: query.internal } : {}),
      ...(query.pattern !== undefined ? { pattern: query.pattern } : {}),
    });
  },

  async show(params: TTopicNameParam): Promise<KafkaTopic> {
    return KafkaTopicService.show(params.topic);
  },

  async create(body: TCreateTopicBody): Promise<{
    name: string;
    numPartitions: number;
    replicationFactor: number;
    created: boolean;
  }> {
    return KafkaTopicService.create({
      name: body.name,
      numPartitions: body.numPartitions,
      replicationFactor: body.replicationFactor,
      ...(body.retentionMs !== undefined ? { retentionMs: body.retentionMs } : {}),
      ...(body.cleanupPolicy !== undefined ? { cleanupPolicy: body.cleanupPolicy } : {}),
      ...(body.compressionType !== undefined ? { compressionType: body.compressionType } : {}),
      ...(body.configEntries !== undefined ? { configEntries: body.configEntries } : {}),
    });
  },

  async remove(params: TTopicNameParam): Promise<{ topic: string; deleted: boolean }> {
    return KafkaTopicService.remove(params.topic);
  },

  async sample(
    params: TTopicNameParam,
    query: TSampleMessagesQuery,
  ): Promise<{ topic: string; messages: KafkaMessage[]; count: number }> {
    return KafkaMessageService.sample(params.topic, {
      fromOffset: query.fromOffset,
      limit: query.limit,
      timeoutMs: query.timeoutMs,
      ...(query.partition !== undefined ? { partition: query.partition } : {}),
    });
  },

  async produce(
    params: TTopicNameParam,
    body: TProduceMessageBody,
  ): Promise<{ topic: string; producedCount: number; partition: number; offset: string }> {
    return KafkaMessageService.produce(params.topic, {
      value: body.value,
      ...(body.key !== undefined ? { key: body.key } : {}),
      ...(body.headers !== undefined ? { headers: body.headers } : {}),
      ...(body.partition !== undefined ? { partition: body.partition } : {}),
    });
  },

  async produceBatch(
    params: TTopicNameParam,
    body: TProduceBatchBody,
  ): Promise<{ topic: string; producedCount: number; partition: number; offset: string }> {
    return KafkaMessageService.produceBatch(
      params.topic,
      body.messages.map((m) => ({
        value: m.value,
        ...(m.key !== undefined ? { key: m.key } : {}),
        ...(m.headers !== undefined ? { headers: m.headers } : {}),
        ...(m.partition !== undefined ? { partition: m.partition } : {}),
      })),
    );
  },
};