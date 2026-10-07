import { describe, it, expect } from 'vitest';

import {
  TopicNameParamSchema,
  TopicListQuerySchema,
  CreateTopicBodySchema,
  SampleMessagesQuerySchema,
} from '@/modules/kafka/schemas/topic.schema';
import {
  ConsumerGroupParamsSchema,
  ConsumerGroupListQuerySchema,
} from '@/modules/kafka/schemas/consumer-group.schema';
import { ResetOffsetBodySchema } from '@/modules/kafka/schemas/consumer-group.schema';

describe('kafka — Zod schemas', () => {
  it('TopicNameParamSchema rejects invalid topic name', () => {
    expect(() => TopicNameParamSchema.parse({ topic: '' })).toThrow();
    expect(() => TopicNameParamSchema.parse({ topic: 'bad topic with space' })).toThrow();
    const ok = TopicNameParamSchema.parse({ topic: 'orders.events' });
    expect(ok.topic).toBe('orders.events');
  });

  it('TopicListQuerySchema defaults internal=false', () => {
    const parsed = TopicListQuerySchema.parse({});
    expect(parsed.internal).toBe(false);
  });

  it('CreateTopicBodySchema accepts defaults', () => {
    const ok = CreateTopicBodySchema.parse({ name: 'orders' });
    expect(ok.name).toBe('orders');
    expect(ok.numPartitions).toBe(1);
    expect(ok.replicationFactor).toBe(1);
  });

  it('SampleMessagesQuerySchema default limit=10', () => {
    const parsed = SampleMessagesQuerySchema.parse({});
    expect(parsed.limit).toBe(10);
    expect(parsed.fromOffset).toBe(0);
  });

  it('ConsumerGroupParamsSchema requires non-empty groupId', () => {
    expect(() => ConsumerGroupParamsSchema.parse({ groupId: '' })).toThrow();
  });

  it('ConsumerGroupListQuerySchema optional state', () => {
    const parsed = ConsumerGroupListQuerySchema.parse({});
    expect(parsed.state).toBeUndefined();
  });

  it('ResetOffsetBodySchema requires topic and reset enum', () => {
    expect(() => ResetOffsetBodySchema.parse({})).toThrow();
    const ok = ResetOffsetBodySchema.parse({ topic: 'orders', reset: 'earliest' });
    expect(ok.reset).toBe('earliest');
  });
});