import { Queue } from 'bullmq';
import { getQueueConnection } from '@/lib/infra/queue';
import type { SilverTransformKind } from '../types';

export const SILVER_QUEUE_NAME = 'silver-transform';

export interface SilverJobPayload {
  jobId: string;
  database: string;
  table: string;
  kind: SilverTransformKind;
  sourceTable?: string;
  partition?: string;
  preserveHistory?: boolean;
  startedAt: string;
}

let queue: Queue<SilverJobPayload> | null = null;

export const SilverQueue = {
  get(): Queue<SilverJobPayload> {
    if (queue) return queue;
    queue = new Queue<SilverJobPayload>(SILVER_QUEUE_NAME, {
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
    payload: SilverJobPayload,
    options?: { delayMs?: number },
  ): Promise<string | null> {
    const q = this.get();
    const job = await q.add(`transform-${payload.kind}`, payload, {
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