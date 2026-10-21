import { decodeMessages, decodeProduce, decodeLag } from './kafka.adapter';
import { decodeTopic, decodeGroup, decodeKafkaStats, decodeCluster, decodeTopicNames, decodeGroupIds } from './kafka.adapter';
import { apiClient } from '../api';
import { ENDPOINTS } from '../api/endpoints';
import type { ApiResponse } from '@/types/commons';
import type {
  KafkaTopic,
  KafkaMessage,
  KafkaProducePayload,
  KafkaProduceResult,
  KafkaProduceBatchPayload,
  KafkaProduceBatchResult,
  KafkaConsumerGroup,
  KafkaConsumerGroupLag,
  KafkaCluster,
  KafkaStats,
} from '@/types/entities';

export interface ListMessagesParams {
  partition?: number;
  offset?: number;
  limit?: number;
  fromTimestamp?: string;
}

export interface ResetOffsetPayload {
  topic: string;
  partition: number;
  offset: 'earliest' | 'latest' | number;
}

export const kafkaService = {
  listTopics: async (): Promise<ReadonlyArray<KafkaTopic>> => {
    const res = await apiClient.get<ApiResponse<ReadonlyArray<KafkaTopic>>>(
      ENDPOINTS.kafka.topics,
    );
    return Promise.all(decodeTopicNames(res.data.data).map((topic) => kafkaService.getTopic(topic)));
  },

  getTopic: async (topic: string): Promise<KafkaTopic> => {
    const res = await apiClient.get<ApiResponse<KafkaTopic>>(
      ENDPOINTS.kafka.topic(topic),
    );
    return decodeTopic(res.data.data);
  },

  deleteTopic: async (topic: string): Promise<void> => {
    await apiClient.delete<ApiResponse<null>>(ENDPOINTS.kafka.topic(topic));
  },

  listMessages: async (
    topic: string,
    params: ListMessagesParams = {},
  ): Promise<ReadonlyArray<KafkaMessage>> => {
    const res = await apiClient.get<ApiResponse<ReadonlyArray<KafkaMessage>>>(
      ENDPOINTS.kafka.topicMessages(topic),
      { params: { partition: params.partition, limit: params.limit, fromOffset: params.offset } },
    );
    return decodeMessages(res.data.data);
  },

  produce: async (topic: string, payload: KafkaProducePayload): Promise<KafkaProduceResult> => {
    const res = await apiClient.post<ApiResponse<KafkaProduceResult>>(
      ENDPOINTS.kafka.topicProduce(topic),
      payload,
    );
    return decodeProduce(res.data.data);
  },

  produceBatch: async (topic: string, payload: KafkaProduceBatchPayload): Promise<KafkaProduceBatchResult> => {
    const res = await apiClient.post<ApiResponse<KafkaProduceBatchResult>>(
      ENDPOINTS.kafka.topicProduceBatch(topic),
      payload,
    );
    return decodeProduce(res.data.data);
  },

  listConsumerGroups: async (): Promise<ReadonlyArray<KafkaConsumerGroup>> => {
    const res = await apiClient.get<ApiResponse<ReadonlyArray<KafkaConsumerGroup>>>(
      ENDPOINTS.kafka.consumerGroups,
    );
    return Promise.all(decodeGroupIds(res.data.data).map((id) => kafkaService.getConsumerGroup(id)));
  },

  getConsumerGroup: async (groupId: string): Promise<KafkaConsumerGroup> => {
    const res = await apiClient.get<ApiResponse<KafkaConsumerGroup>>(
      ENDPOINTS.kafka.consumerGroup(groupId),
    );
    return decodeGroup(res.data.data);
  },

  deleteConsumerGroup: async (groupId: string): Promise<void> => {
    await apiClient.delete<ApiResponse<null>>(ENDPOINTS.kafka.consumerGroup(groupId));
  },

  getConsumerGroupLag: async (groupId: string): Promise<ReadonlyArray<KafkaConsumerGroupLag>> => {
    const res = await apiClient.get<ApiResponse<ReadonlyArray<KafkaConsumerGroupLag>>>(
      ENDPOINTS.kafka.consumerGroupLag(groupId),
    );
    return decodeLag(res.data.data);
  },

  resetOffset: async (groupId: string, payload: ResetOffsetPayload): Promise<void> => {
    await apiClient.post<ApiResponse<null>>(
      ENDPOINTS.kafka.consumerGroupReset(groupId),
      { topic: payload.topic, partitions: [payload.partition], reset: typeof payload.offset === 'number' ? 'specific' : payload.offset, ...(typeof payload.offset === 'number' ? { offset: payload.offset } : {}) },
    );
  },

  getCluster: async (): Promise<KafkaCluster> => {
    const res = await apiClient.get<ApiResponse<KafkaCluster>>(ENDPOINTS.kafka.cluster);
    return decodeCluster(res.data.data);
  },

  getStats: async (): Promise<KafkaStats> => {
    const res = await apiClient.get<ApiResponse<KafkaStats>>(ENDPOINTS.kafka.stats);
    return decodeKafkaStats(res.data.data);
  },
};
