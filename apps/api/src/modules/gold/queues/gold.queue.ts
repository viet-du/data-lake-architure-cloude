import { Queue } from 'bullmq';
import { getQueueConnection } from '@/lib/infra/queue';
import type { GoldAggregateKind } from '../types';

export const GOLD_QUEUE_NAME = 'gold-aggregate';

export interface GoldJobPayload {
  jobId: string;
  database: string;
  table: string;
  kind: GoldAggregateKind;
  sourceTables: string[];
  partition?: string;
  preserveHistory?: boolean;
  startedAt: string;
}

let queue: Queue<GoldJobPayload> | null = null;

export const GoldQueue = {
  get(): Queue<GoldJobPayload> {
    if (queue) return queue;
    queue = new Queue<GoldJobPayload>(GOLD_QUEUE_NAME, {
      connection: getQueueConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 100, age: 7 * 24 * 60 * 60 },
        removeOnFail: { count: 500, age: 30 * 24 * 60 * 60 },
      },
    });
    return queue;
  },

  async add(
    payload: GoldJobPayload,
    options?: { delayMs?: number },
  ): Promise<string | null> {
    const q = this.get();
    const job = await q.add(`aggregate-${payload.kind}`, payload, {
      ...(options?.delayMs !== undefined ? { delay: options.delayMs } : {}),
      jobId: payload.jobId,
    });
    return job?.id ?? null;
  },

  async cancel(jobId: string): Promise<boolean> {
    const q = this.get();
    const job = await q.getJob(jobId);
    if (!job) return false;
    await job.remove();
    return true;
  },

  async close(): Promise<void> {
    if (!queue) return;
    await queue.close();
    queue = null;
  },
};