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
    return res.data.data;
  },

  getTopic: async (topic: string): Promise<KafkaTopic> => {
    const res = await apiClient.get<ApiResponse<KafkaTopic>>(
      ENDPOINTS.kafka.topic(topic),
    );
    return res.data.data;
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
      { params: { ...params } },
    );
    return res.data.data;
  },

  produce: async (topic: string, payload: KafkaProducePayload): Promise<KafkaProduceResult> => {
    const res = await apiClient.post<ApiResponse<KafkaProduceResult>>(
      ENDPOINTS.kafka.topicProduce(topic),
      payload,
    );
    return res.data.data;
  },

  produceBatch: async (topic: string, payload: KafkaProduceBatchPayload): Promise<KafkaProduceBatchResult> => {
    const res = await apiClient.post<ApiResponse<KafkaProduceBatchResult>>(
      ENDPOINTS.kafka.topicProduceBatch(topic),
      payload,
    );
    return res.data.data;
  },

  listConsumerGroups: async (): Promise<ReadonlyArray<KafkaConsumerGroup>> => {
    const res = await apiClient.get<ApiResponse<ReadonlyArray<KafkaConsumerGroup>>>(
      ENDPOINTS.kafka.consumerGroups,
    );
    return res.data.data;
  },

  getConsumerGroup: async (groupId: string): Promise<KafkaConsumerGroup> => {
    const res = await apiClient.get<ApiResponse<KafkaConsumerGroup>>(
      ENDPOINTS.kafka.consumerGroup(groupId),
    );
    return res.data.data;
  },

  deleteConsumerGroup: async (groupId: string): Promise<void> => {
    await apiClient.delete<ApiResponse<null>>(ENDPOINTS.kafka.consumerGroup(groupId));
  },

  getConsumerGroupLag: async (groupId: string): Promise<ReadonlyArray<KafkaConsumerGroupLag>> => {
    const res = await apiClient.get<ApiResponse<ReadonlyArray<KafkaConsumerGroupLag>>>(
      ENDPOINTS.kafka.consumerGroupLag(groupId),
    );
    return res.data.data;
  },

  resetOffset: async (groupId: string, payload: ResetOffsetPayload): Promise<void> => {
    await apiClient.post<ApiResponse<null>>(
      ENDPOINTS.kafka.consumerGroupReset(groupId),
      payload,
    );
  },

  getCluster: async (): Promise<KafkaCluster> => {
    const res = await apiClient.get<ApiResponse<KafkaCluster>>(ENDPOINTS.kafka.cluster);
    return res.data.data;
  },

  getStats: async (): Promise<KafkaStats> => {
    const res = await apiClient.get<ApiResponse<KafkaStats>>(ENDPOINTS.kafka.stats);
    return res.data.data;
  },
};
