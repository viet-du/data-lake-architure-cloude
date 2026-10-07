import type { Worker } from 'bullmq';
import { SilverTransformWorker } from './transform.worker';
import { logger } from '@/lib/logger';

const workers: Worker[] = [];

export const SilverWorkerManager = {
  startAll(): void {
    if (workers.length > 0) return;
    workers.push(SilverTransformWorker.start());
    logger.info({ count: workers.length }, 'Silver workers started');
  },

  async stopAll(): Promise<void> {
    for (const w of workers) {
      await w.close();
    }
    workers.length = 0;
    logger.info('Silver workers stopped');
  },

  isStarted(): boolean {
    return workers.length > 0;
  },
};

export { SilverTransformWorker };