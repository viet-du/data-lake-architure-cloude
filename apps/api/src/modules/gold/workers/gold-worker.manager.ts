import type { Worker } from 'bullmq';
import { GoldAggregateWorker } from './aggregate.worker';
import { logger } from '@/lib/logger';

const workers: Worker[] = [];

export const GoldWorkerManager = {
  startAll(): void {
    if (workers.length > 0) return;
    workers.push(GoldAggregateWorker.start());
    logger.info({ count: workers.length }, 'Gold workers started');
  },

  async stopAll(): Promise<void> {
    for (const w of workers) {
      await w.close();
    }
    workers.length = 0;
    logger.info('Gold workers stopped');
  },

  isStarted(): boolean {
    return workers.length > 0;
  },
};

export { GoldAggregateWorker };