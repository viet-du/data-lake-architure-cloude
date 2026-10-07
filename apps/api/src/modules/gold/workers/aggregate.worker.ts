import { Worker, type Job } from 'bullmq';
import { getQueueConnection } from '@/lib/infra/queue';
import { GoldJobRepository } from '../repositories';
import { GoldDuckDBRepository } from '../repositories/duckdb.repository';
import { GOLD_QUEUE_NAME, type GoldJobPayload } from '../queues/gold.queue';
import { logger } from '@/lib/logger';

export async function processAggregate(payload: GoldJobPayload): Promise<{
  rowsAggregated: number;
  bytesProcessed: number;
}> {
  logger.info(
    {
      jobId: payload.jobId,
      database: payload.database,
      table: payload.table,
      kind: payload.kind,
      sourceTables: payload.sourceTables,
    },
    'Gold aggregate started',
  );
  const sources = payload.sourceTables.length > 0 ? payload.sourceTables : [payload.table];
  const result =
    payload.kind === 'refresh' && payload.preserveHistory !== true
      ? await GoldDuckDBRepository.refresh(
          payload.database,
          payload.table,
          sources,
          payload.partition,
        )
      : await GoldDuckDBRepository.runAggregate(
          payload.database,
          payload.table,
          sources,
          payload.partition,
        );
  return { rowsAggregated: result.rowCount, bytesProcessed: result.bytesProcessed };
}

export const GoldAggregateWorker = {
  start(): Worker<GoldJobPayload> {
    return new Worker<GoldJobPayload>(
      GOLD_QUEUE_NAME,
      async (job: Job<GoldJobPayload>) => {
        await GoldJobRepository.update(job.data.jobId, {
          status: 'running',
          attemptsMade: job.attemptsMade,
        });
        try {
          const result = await processAggregate(job.data);
          await GoldJobRepository.update(job.data.jobId, {
            status: 'completed',
            rowCount: result.rowsAggregated,
            bytesProcessed: result.bytesProcessed,
            finishedAt: new Date().toISOString(),
          });
          return result;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await GoldJobRepository.update(job.data.jobId, {
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