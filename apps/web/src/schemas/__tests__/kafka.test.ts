import { describe, it, expect } from 'vitest';
import {
  kafkaTopicSchema,
  kafkaMessageSchema,
  kafkaProducePayloadSchema,
  consumerGroupStateSchema,
  kafkaClusterSchema,
  kafkaStatsSchema,
} from '../kafka';

describe('kafka schema', () => {
  describe('consumerGroupStateSchema', () => {
    it('accepts all five states', () => {
      for (const s of [
        'Stable',
        'PreparingRebalance',
        'CompletingRebalance',
        'Empty',
        'Dead',
      ]) {
        expect(consumerGroupStateSchema.parse(s)).toBe(s);
      }
    });

    it('rejects unknown states', () => {
      expect(() => consumerGroupStateSchema.parse('Active')).toThrow();
    });
  });

  describe('kafkaTopicSchema', () => {
    const baseTopic = {
      name: 'crawler.tiki.products',
      partitions: 6,
      replicationFactor: 1,
      retentionMs: 604800000,
      messagesPerSec: 12.5,
      consumerGroups: 2,
      lag: 0,
      status: 'healthy' as const,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-15T10:00:00Z',
    };

    it('accepts a valid topic', () => {
      expect(kafkaTopicSchema.parse(baseTopic).name).toBe(baseTopic.name);
    });

    it('rejects negative partitions', () => {
      expect(() =>
        kafkaTopicSchema.parse({ ...baseTopic, partitions: -1 }),
      ).toThrow();
    });

    it('rejects empty name', () => {
      expect(() => kafkaTopicSchema.parse({ ...baseTopic, name: '' })).toThrow();
    });
  });

  describe('kafkaMessageSchema', () => {
    it('accepts a message with key + value', () => {
      const msg = {
        partition: 0,
        offset: 42,
        timestamp: '2026-01-15T10:00:00Z',
        key: 'k1',
        value: 'hello',
      };
      expect(kafkaMessageSchema.parse(msg).offset).toBe(42);
    });

    it('rejects empty value', () => {
      expect(() =>
        kafkaMessageSchema.parse({
          partition: 0,
          offset: 1,
          timestamp: '2026-01-15T10:00:00Z',
          value: '',
        }),
      ).toThrow();
    });
  });

  describe('kafkaProducePayloadSchema', () => {
    it('requires value', () => {
      expect(() =>
        kafkaProducePayloadSchema.parse({ key: 'k' }),
      ).toThrow();
    });

    it('accepts value + headers + partition', () => {
      const out = kafkaProducePayloadSchema.parse({
        key: 'k',
        value: 'v',
        headers: { 'source': 'web' },
        partition: 2,
      });
      expect(out.partition).toBe(2);
    });
  });

  describe('kafkaClusterSchema', () => {
    it('accepts a valid cluster', () => {
      const c = {
        brokerCount: 3,
        controllerId: 1,
        clusterId: 'abc-123',
        topics: 12,
        consumerGroups: 4,
        totalMessages: 1000000,
        version: 'v23.1.7',
      };
      expect(kafkaClusterSchema.parse(c).clusterId).toBe('abc-123');
    });
  });

  describe('kafkaStatsSchema', () => {
    it('accepts a valid stats payload', () => {
      const s = {
        topics: 10,
        consumerGroups: 4,
        totalPartitions: 30,
        totalMessagesPerSec: 100,
        totalLag: 0,
      };
      expect(kafkaStatsSchema.parse(s).topics).toBe(10);
    });

    it('rejects negative totals', () => {
      expect(() =>
        kafkaStatsSchema.parse({
          topics: -1,
          consumerGroups: 0,
          totalPartitions: 0,
          totalMessagesPerSec: 0,
          totalLag: 0,
        }),
      ).toThrow();
    });
  });
});
