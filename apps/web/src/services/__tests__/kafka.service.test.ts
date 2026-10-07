import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/store', () => ({
  useAuthStore: { getState: () => ({ token: null }) },
}));

import { apiClient } from '../api';
import { kafkaService } from '../kafka';
import { ENDPOINTS } from '../api/endpoints';

describe('kafkaService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listTopics hits /api/kafka/topics', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: { success: true, data: [{ name: 't1' }] },
    });
    const out = await kafkaService.listTopics();
    expect(get).toHaveBeenCalledWith(ENDPOINTS.kafka.topics);
    expect(out).toEqual([{ name: 't1' }]);
  });

  it('getTopic hits /api/kafka/topics/:topic', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: { success: true, data: { name: 't1' } },
    });
    await kafkaService.getTopic('t1');
    expect(get).toHaveBeenCalledWith(ENDPOINTS.kafka.topic('t1'));
  });

  it('deleteTopic DELETES /api/kafka/topics/:topic', async () => {
    const del = vi.spyOn(apiClient, 'delete').mockResolvedValue({
      data: { success: true },
    });
    await kafkaService.deleteTopic('t1');
    expect(del).toHaveBeenCalledWith(ENDPOINTS.kafka.topic('t1'));
  });

  it('listMessages passes params', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: { success: true, data: [] },
    });
    await kafkaService.listMessages('t1', { limit: 10, partition: 0 });
    expect(get).toHaveBeenCalledWith(ENDPOINTS.kafka.topicMessages('t1'), {
      params: { limit: 10, partition: 0 },
    });
  });

  it('produce POSTs to /api/kafka/topics/:topic/produce', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({
      data: { success: true, data: { offset: 1, partition: 0, topic: 't1', timestamp: 'x' } },
    });
    await kafkaService.produce('t1', { value: 'v' });
    expect(post).toHaveBeenCalledWith(ENDPOINTS.kafka.topicProduce('t1'), {
      value: 'v',
    });
  });

  it('getCluster hits /api/kafka/cluster', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: { success: true, data: { clusterId: 'c1' } },
    });
    const out = await kafkaService.getCluster();
    expect(get).toHaveBeenCalledWith(ENDPOINTS.kafka.cluster);
    expect(out.clusterId).toBe('c1');
  });

  it('resetOffset POSTs to /api/kafka/consumer-groups/:id/reset-offset', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({
      data: { success: true },
    });
    await kafkaService.resetOffset('g1', { topic: 't1', partition: 0, offset: 'earliest' });
    expect(post).toHaveBeenCalledWith(ENDPOINTS.kafka.consumerGroupReset('g1'), {
      topic: 't1',
      partition: 0,
      offset: 'earliest',
    });
  });
});
