import { Queue } from 'bullmq';
import { getQueueConnection } from '@/lib/infra/queue';
import type { BronzeIngestKind } from '../types';

export const BRONZE_QUEUE_NAME = 'bronze-ingest';

export interface BronzeJobPayload {
  jobId: string;
  database: string;
  table: string;
  kind: BronzeIngestKind;
  source?: string;
  topic?: string;
  partition?: string;
  options?: Record<string, unknown>;
  consumerGroup?: string;
  maxMessages?: number;
  timeoutMs?: number;
  startedAt: string;
}

let queue: Queue<BronzeJobPayload> | null = null;

export const BronzeQueue = {
  get(): Queue<BronzeJobPayload> {
    if (queue) return queue;
    queue = new Queue<BronzeJobPayload>(BRONZE_QUEUE_NAME, {
      connection: getQueueConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { count: 100, age: 7 * 24 * 60 * 60 },
        removeOnFail: { count: 500, age: 30 * 24 * 60 * 60 },
      },
    });
    return queue;
  },

  async add(
    payload: BronzeJobPayload,
    options?: { delayMs?: number },
  ): Promise<string | null> {
    const q = this.get();
    const job = await q.add(`ingest-${payload.kind}`, payload, {
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