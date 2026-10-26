import { describe, it, expect, vi } from 'vitest';

import { KafkaClient } from '@/modules/kafka/repositories/kafka-client';
import { normalizeCommittedOffset } from '@/modules/kafka/repositories/kafka.repository';

/**
 * The regression guards for the Kafka statistics endpoint.
 *
 * `GET /api/kafka/stats` used to answer HTTP 500 with
 *
 *   TypeError: Cannot destructure property 'partitions' of 'c.pop(...)'
 *              as it is undefined.
 *
 * Inside kafkajs, `admin.fetchTopicOffsets(topic)` fetches the high and the
 * low watermark and then calls `high.pop()` / `low.pop()`. When the topic is
 * not part of the client's cached metadata — a topic that was just created
 * by the crawler, or one that was deleted while the API was running — the
 * fetch resolves with an *empty* array, `pop()` returns `undefined`, and
 * kafkajs throws a plain `TypeError` that no route can interpret.
 *
 * The dashboard then showed a broken screen for a topic that is simply not
 * readable *yet*.
 *
 * These tests pin the contract: the wrapper answers with the offsets when
 * they exist, and with an empty list — never with an exception — when they
 * do not.
 */

interface OffsetLike {
  partition: number;
  offset: string;
}

/** The shape of the part of the kafkajs admin the wrapper uses. */
function fakeAdmin(offsets: OffsetLike[] | Error) {
  return {
    fetchTopicOffsets: vi.fn(async () => {
      if (offsets instanceof Error) throw offsets;
      return offsets;
    }),
    fetchTopicMetadata: vi.fn(async () => ({ topics: [] })),
  };
}

describe('KafkaClient.safeFetchTopicOffsets', () => {
  it('returns the offsets when they can be read', async () => {
    const admin = fakeAdmin([
      { partition: 0, offset: '10' },
      { partition: 1, offset: '20' },
    ]);

    const offsets = await KafkaClient.safeFetchTopicOffsets(admin as never, 'orders');

    expect(offsets).toHaveLength(2);
    expect(offsets[0]).toMatchObject({ partition: 0, offset: '10' });
  });

  it('returns an empty list instead of throwing when the topic is unknown', async () => {
    // This is exactly the kafkajs failure: the fetch resolves with an empty
    // array and the internal `pop()` then throws.
    const admin = {
      fetchTopicOffsets: vi.fn(async () => {
        throw new TypeError(
          "Cannot destructure property 'partitions' of 'c.pop(...)' as it is undefined.",
        );
      }),
      fetchTopicMetadata: vi.fn(async () => ({ topics: [] })),
    };

    await expect(KafkaClient.safeFetchTopicOffsets(admin as never, 'ghost')).resolves.toEqual([]);
  });

  it('refreshes the metadata once and retries before giving up', async () => {
    const fetchTopicOffsets = vi
      .fn()
      .mockRejectedValueOnce(
        new TypeError("Cannot destructure property 'partitions' of 'c.pop(...)' as it is undefined."),
      )
      .mockResolvedValueOnce([{ partition: 0, offset: '5' }]);
    const admin = {
      fetchTopicOffsets,
      fetchTopicMetadata: vi.fn(async () => ({ topics: [] })),
    };

    const offsets = await KafkaClient.safeFetchTopicOffsets(admin as never, 'orders');

    expect(offsets).toEqual([{ partition: 0, offset: '5' }]);
    expect(admin.fetchTopicMetadata).toHaveBeenCalledTimes(1);
    expect(fetchTopicOffsets).toHaveBeenCalledTimes(2);
  });

  it('does not retry forever when the metadata refresh also fails', async () => {
    const admin = {
      fetchTopicOffsets: vi.fn(async () => {
        throw new Error('broker down');
      }),
      fetchTopicMetadata: vi.fn(async () => {
        throw new Error('broker down');
      }),
    };

    await expect(KafkaClient.safeFetchTopicOffsets(admin as never, 'orders')).resolves.toEqual([]);
    expect(admin.fetchTopicOffsets).toHaveBeenCalledTimes(1);
  });
});

describe('normalizeCommittedOffset', () => {
  /**
   * Kafka answers `-1` for a partition whose consumer group never committed
   * an offset. `-1` is a *marker*, not an offset. Subtracting it from the
   * end offset inflates the lag by one and reports a backlog that does not
   * exist.
   */
  it('turns the "never committed" marker into the beginning of the partition', () => {
    expect(normalizeCommittedOffset('-1')).toBe('0');
  });

  it('keeps a real committed offset', () => {
    expect(normalizeCommittedOffset('42')).toBe('42');
    expect(normalizeCommittedOffset('0')).toBe('0');
  });

  it('falls back to the beginning when the offset is missing or malformed', () => {
    expect(normalizeCommittedOffset(undefined)).toBe('0');
    expect(normalizeCommittedOffset('not-a-number')).toBe('0');
  });
});
