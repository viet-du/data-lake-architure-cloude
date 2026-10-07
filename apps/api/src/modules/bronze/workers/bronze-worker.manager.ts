import type { Worker } from 'bullmq';
import { CsvWorker } from './ingest-csv.worker';
import { JsonWorker } from './ingest-json.worker';
import { StreamWorker } from './ingest-stream.worker';
import { logger } from '@/lib/logger';

const workers: Worker[] = [];

export const BronzeWorkerManager = {
  startAll(): void {
    if (workers.length > 0) return;
    workers.push(CsvWorker.start());
    workers.push(JsonWorker.start());
    workers.push(StreamWorker.start());
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

export { CsvWorker, JsonWorker, StreamWorker };