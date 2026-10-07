import { useMutation, useQuery, useQueryClient, type UseMutationOptions, type UseQueryOptions } from '@tanstack/react-query';
import { kafkaService, type ListMessagesParams, type ResetOffsetPayload } from '../kafka';
import { QUERY_KEYS } from '../query-keys';
import type {
  KafkaCluster,
  KafkaConsumerGroup,
  KafkaConsumerGroupLag,
  KafkaMessage,
  KafkaProduceBatchPayload,
  KafkaProduceBatchResult,
  KafkaProducePayload,
  KafkaProduceResult,
  KafkaStats,
  KafkaTopic,
} from '@/types/entities';

export function useKafkaTopicsQuery(
  options?: Omit<UseQueryOptions<ReadonlyArray<KafkaTopic>, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<ReadonlyArray<KafkaTopic>, Error>({
    queryKey: QUERY_KEYS.kafka.topics(),
    queryFn: () => kafkaService.listTopics(),
    ...options,
  });
}

export function useKafkaTopicQuery(
  topic: string,
  options?: Omit<UseQueryOptions<KafkaTopic, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<KafkaTopic, Error>({
    queryKey: QUERY_KEYS.kafka.topic(topic),
    queryFn: () => kafkaService.getTopic(topic),
    enabled: topic.length > 0,
    ...options,
  });
}

export function useKafkaMessagesQuery(
  topic: string,
  params?: ListMessagesParams,
  options?: Omit<UseQueryOptions<ReadonlyArray<KafkaMessage>, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<ReadonlyArray<KafkaMessage>, Error>({
    queryKey: [...QUERY_KEYS.kafka.topicMessages(topic), params ?? {}],
    queryFn: () => kafkaService.listMessages(topic, params),
    enabled: topic.length > 0,
    ...options,
  });
}

export function useKafkaConsumerGroupsQuery(
  options?: Omit<UseQueryOptions<ReadonlyArray<KafkaConsumerGroup>, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<ReadonlyArray<KafkaConsumerGroup>, Error>({
    queryKey: QUERY_KEYS.kafka.consumerGroups(),
    queryFn: () => kafkaService.listConsumerGroups(),
    ...options,
  });
}

export function useKafkaConsumerGroupQuery(
  groupId: string,
  options?: Omit<UseQueryOptions<KafkaConsumerGroup, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<KafkaConsumerGroup, Error>({
    queryKey: QUERY_KEYS.kafka.consumerGroup(groupId),
    queryFn: () => kafkaService.getConsumerGroup(groupId),
    enabled: groupId.length > 0,
    ...options,
  });
}

export function useKafkaConsumerGroupLagQuery(
  groupId: string,
  options?: Omit<UseQueryOptions<ReadonlyArray<KafkaConsumerGroupLag>, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<ReadonlyArray<KafkaConsumerGroupLag>, Error>({
    queryKey: QUERY_KEYS.kafka.consumerGroupLag(groupId),
    queryFn: () => kafkaService.getConsumerGroupLag(groupId),
    enabled: groupId.length > 0,
    ...options,
  });
}

export function useKafkaClusterQuery(
  options?: Omit<UseQueryOptions<KafkaCluster, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<KafkaCluster, Error>({
    queryKey: QUERY_KEYS.kafka.cluster(),
    queryFn: () => kafkaService.getCluster(),
    ...options,
  });
}

export function useKafkaStatsQuery(
  options?: Omit<UseQueryOptions<KafkaStats, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<KafkaStats, Error>({
    queryKey: QUERY_KEYS.kafka.stats(),
    queryFn: () => kafkaService.getStats(),
    ...options,
  });
}

export function useProduceMutation(
  options?: UseMutationOptions<KafkaProduceResult, Error, { topic: string; payload: KafkaProducePayload }>,
) {
  const qc = useQueryClient();
  return useMutation<KafkaProduceResult, Error, { topic: string; payload: KafkaProducePayload }>({
    mutationFn: ({ topic, payload }) => kafkaService.produce(topic, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.kafka.all });
    },
    ...options,
  });
}

export function useProduceBatchMutation(
  options?: UseMutationOptions<KafkaProduceBatchResult, Error, { topic: string; payload: KafkaProduceBatchPayload }>,
) {
  const qc = useQueryClient();
  return useMutation<KafkaProduceBatchResult, Error, { topic: string; payload: KafkaProduceBatchPayload }>({
    mutationFn: ({ topic, payload }) => kafkaService.produceBatch(topic, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.kafka.all });
    },
    ...options,
  });
}

export function useResetOffsetMutation(
  options?: UseMutationOptions<void, Error, { groupId: string; payload: ResetOffsetPayload }>,
) {
  const qc = useQueryClient();
  return useMutation<void, Error, { groupId: string; payload: ResetOffsetPayload }>({
    mutationFn: ({ groupId, payload }) => kafkaService.resetOffset(groupId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.kafka.consumerGroupLag('') });
    },
    ...options,
  });
}

export function useDeleteKafkaTopicMutation(
  options?: UseMutationOptions<void, Error, string>,
) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (topic) => kafkaService.deleteTopic(topic),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.kafka.topics() });
    },
    ...options,
  });
}
