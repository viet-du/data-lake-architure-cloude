import { Worker, type Job } from 'bullmq';
import { getQueueConnection } from '@/lib/infra/queue';
import { BronzeJobRepository } from '../repositories';
import { BRONZE_QUEUE_NAME, type BronzeJobPayload } from '../queues/bronze.queue';
import { logger } from '@/lib/logger';

export async function processStreamIngest(payload: BronzeJobPayload): Promise<{
  rowsIngested: number;
  bytesProcessed: number;
}> {
  if (!payload.topic) throw new Error('Stream ingest requires Kafka topic');
  const consumerGroup = payload.consumerGroup ?? 'bronze-ingestor';
  const maxMessages = payload.maxMessages ?? 10_000;
  logger.info(
    {
      jobId: payload.jobId,
      database: payload.database,
      table: payload.table,
      topic: payload.topic,
      consumerGroup,
      maxMessages,
    },
    'Stream ingest started (stub)',
  );
  return { rowsIngested: 0, bytesProcessed: 0 };
}

export const StreamWorker = {
  start(): Worker<BronzeJobPayload> {
    return new Worker<BronzeJobPayload>(
      BRONZE_QUEUE_NAME,
      async (job: Job<BronzeJobPayload>) => {
        if (job.data.kind !== 'stream') return;
        await BronzeJobRepository.update(job.data.jobId, {
          status: 'running',
          attemptsMade: job.attemptsMade,
        });
        try {
          const result = await processStreamIngest(job.data);
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
      { connection: getQueueConnection(), concurrency: 1 },
    );
  },
};