import { Worker, type Job } from 'bullmq';
import { getQueueConnection } from '@/lib/infra/queue';
import { SilverJobRepository } from '../repositories';
import { SilverDuckDBRepository } from '../repositories/duckdb.repository';
import { SILVER_QUEUE_NAME, type SilverJobPayload } from '../queues/silver.queue';
import { logger } from '@/lib/logger';

export async function processTransform(payload: SilverJobPayload): Promise<{
  rowsTransformed: number;
  bytesProcessed: number;
}> {
  logger.info(
    {
      jobId: payload.jobId,
      database: payload.database,
      table: payload.table,
      kind: payload.kind,
      sourceTable: payload.sourceTable,
    },
    'Silver transform started',
  );
  const result =
    payload.kind === 'refresh' && payload.preserveHistory !== true
      ? await SilverDuckDBRepository.refresh(
          payload.database,
          payload.table,
          ...(payload.sourceTable ? [payload.sourceTable] : []),
          ...(payload.partition ? [payload.partition] : []),
        )
      : await SilverDuckDBRepository.runTransform(
          payload.database,
          payload.table,
          ...(payload.sourceTable ? [payload.sourceTable] : []),
          ...(payload.partition ? [payload.partition] : []),
        );
  return { rowsTransformed: result.rowCount, bytesProcessed: result.bytesProcessed };
}

export const SilverTransformWorker = {
  start(): Worker<SilverJobPayload> {
    return new Worker<SilverJobPayload>(
      SILVER_QUEUE_NAME,
      async (job: Job<SilverJobPayload>) => {
        await SilverJobRepository.update(job.data.jobId, {
          status: 'running',
          attemptsMade: job.attemptsMade,
        });
        try {
          const result = await processTransform(job.data);
          await SilverJobRepository.update(job.data.jobId, {
            status: 'completed',
            rowCount: result.rowsTransformed,
            bytesProcessed: result.bytesProcessed,
            finishedAt: new Date().toISOString(),
          });
          return result;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await SilverJobRepository.update(job.data.jobId, {
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