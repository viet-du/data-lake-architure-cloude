import { Queue } from 'bullmq';
import { getQueueConnection } from '@/lib/infra/queue';
import type { CrawlerName, CrawlerRunRequest } from '../types';

export const CRAWLER_QUEUE_NAME = 'crawler-run';

export interface CrawlerJobPayload {
  jobId: string;
  runId: string;
  crawler: CrawlerName;
  request: CrawlerRunRequest;
  requestedBy?: string;
  startedAt: string;
}

let queue: Queue<CrawlerJobPayload> | null = null;

export const CrawlerQueue = {
  get(): Queue<CrawlerJobPayload> {
    if (queue) return queue;
    queue = new Queue<CrawlerJobPayload>(CRAWLER_QUEUE_NAME, {
      connection: getQueueConnection(),
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: { count: 200, age: 7 * 24 * 60 * 60 },
        removeOnFail: { count: 500, age: 30 * 24 * 60 * 60 },
      },
    });
    return queue;
  },

  async add(payload: CrawlerJobPayload): Promise<string | null> {
    const q = this.get();
    const job = await q.add(`crawl-${payload.crawler}`, payload, {
      jobId: payload.runId,
    });
    return job?.id ?? null;
  },

  async cancel(runId: string): Promise<boolean> {
    const q = this.get();
    const job = await q.getJob(runId);
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