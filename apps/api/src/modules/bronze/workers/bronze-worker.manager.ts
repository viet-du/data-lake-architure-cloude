import type { Worker } from 'bullmq';
import { BronzeWorker } from './bronze.worker';
import { logger } from '@/lib/logger';

const workers: Worker[] = [];

export const BronzeWorkerManager = {
  startAll(): void {
    if (workers.length > 0) return;
    workers.push(BronzeWorker.start());
    logger.info({ count: workers.length }, 'Bronze workers started');
  },

  async stopAll(): Promise<void> {
    for (const w of workers) {
      await w.close();
    }
    workers.length = 0;
    logger.info('Bronze workers stopped');
  },

  isStarted(): boolean {
    return workers.length > 0;
  },
};

export { BronzeWorker as CsvWorker, BronzeWorker as JsonWorker, BronzeWorker as StreamWorker } from './bronze.worker';