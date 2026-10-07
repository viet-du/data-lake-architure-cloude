import {
  KafkaClusterService,
  KafkaHealthService,
} from '../services/kafka.service';
import type { KafkaClusterInfo, KafkaStats } from '../types';

export const KafkaClusterController = {
  async info(): Promise<KafkaClusterInfo> {
    return KafkaClusterService.info();
  },

  async stats(): Promise<KafkaStats> {
    return KafkaClusterService.stats();
  },

  async health(): Promise<{ connected: boolean; brokers: string[] }> {
    return KafkaHealthService.health();
  },
};