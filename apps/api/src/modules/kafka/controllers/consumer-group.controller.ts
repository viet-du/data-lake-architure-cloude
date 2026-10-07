import { KafkaConsumerGroupService } from '../services/kafka.service';
import type {
  KafkaConsumerGroup,
  KafkaLagPartition,
} from '../types';
import type {
  TConsumerGroupParams,
  TConsumerGroupListQuery,
  TConsumerGroupLagQuery,
  TResetOffsetBody,
} from '../schemas';

export const KafkaConsumerGroupController = {
  async list(
    query: TConsumerGroupListQuery,
  ): Promise<{ groups: Array<{ groupId: string; state: string; protocol: string }>; count: number }> {
    return KafkaConsumerGroupService.list({
      ...(query.state !== undefined ? { state: query.state } : {}),
      ...(query.pattern !== undefined ? { pattern: query.pattern } : {}),
    });
  },

  async show(params: TConsumerGroupParams): Promise<KafkaConsumerGroup> {
    return KafkaConsumerGroupService.show(params.groupId);
  },

  async remove(params: TConsumerGroupParams): Promise<{ groupId: string; deleted: boolean }> {
    return KafkaConsumerGroupService.remove(params.groupId);
  },

  async lag(
    params: TConsumerGroupParams,
    query: TConsumerGroupLagQuery,
  ): Promise<{ groupId: string; partitions: KafkaLagPartition[]; totalLag: number }> {
    return KafkaConsumerGroupService.lag(
      params.groupId,
      query.topic !== undefined ? query.topic : undefined,
    );
  },

  async resetOffset(
    params: TConsumerGroupParams,
    body: TResetOffsetBody,
  ): Promise<{
    groupId: string;
    topic: string;
    reset: string;
    partitions?: number[];
    offset?: number;
  }> {
    return KafkaConsumerGroupService.resetOffset(params.groupId, {
      reset: body.reset,
      topic: body.topic,
      ...(body.offset !== undefined ? { offset: body.offset } : {}),
      ...(body.partitions ? { partitions: body.partitions } : {}),
    });
  },
};