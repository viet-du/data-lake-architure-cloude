import { Worker, type Job } from 'bullmq';
import { getQueueConnection } from '@/lib/infra/queue';
import { BronzeJobRepository } from '../repositories';
import { BRONZE_QUEUE_NAME, type BronzeJobPayload } from '../queues/bronze.queue';
import { logger } from '@/lib/logger';

interface JsonOptions {
  format: 'json' | 'jsonl' | 'ndjson';
  compression: 'none' | 'gzip' | 'zstd';
}

export async function processJsonIngest(payload: BronzeJobPayload): Promise<{
  rowsIngested: number;
  bytesProcessed: number;
}> {
  if (!payload.source) throw new Error('JSON ingest requires source path');
  const options = (payload.options as JsonOptions | undefined) ?? { format: 'jsonl', compression: 'none' };
  logger.info(
    {
      jobId: payload.jobId,
      database: payload.database,
      table: payload.table,
      source: payload.source,
      options,
    },
    'JSON ingest started (stub)',
  );
  void payload.partition;
  return { rowsIngested: 0, bytesProcessed: 0 };
}

export const JsonWorker = {
  start(): Worker<BronzeJobPayload> {
    return new Worker<BronzeJobPayload>(
      BRONZE_QUEUE_NAME,
      async (job: Job<BronzeJobPayload>) => {
        if (job.data.kind !== 'json') return;
        await BronzeJobRepository.update(job.data.jobId, {
          status: 'running',
          attemptsMade: job.attemptsMade,
        });
        try {
          const result = await processJsonIngest(job.data);
          await BronzeJobRepository.update(job.data.jobId, {
            status: 'completed',
            rowCount: result.rowsIngested,
            bytesProcessed: result.bytesProcessed,
            finishedAt: new Date().toISOString(),
          });
          return result;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await BronzeJobRepository.update(job.data.jobId, {
            status: 'failed',
            errorMessage: msg,
            finishedAt: new Date().toISOString(),
          });
          throw err;
        }
      },
      { connection: getQueueConnection(), concurrency: 2 },
    );
  },
};