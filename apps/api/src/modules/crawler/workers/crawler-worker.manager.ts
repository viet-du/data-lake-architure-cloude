import type { Worker } from 'bullmq';
import { CrawlerRunWorker } from './crawl.worker';
import { logger } from '@/lib/logger';

const workers: Worker[] = [];

export const CrawlerWorkerManager = {
  startAll(): void {
    if (workers.length > 0) return;
    workers.push(CrawlerRunWorker.start());
    logger.info({ count: workers.length }, 'Crawler workers started');
  },

  async stopAll(): Promise<void> {
    for (const w of workers) {
      await w.close();
    }
    workers.length = 0;
    logger.info('Crawler workers stopped');
  },

  isStarted(): boolean {
    return workers.length > 0;
  },
};

export { CrawlerRunWorker };