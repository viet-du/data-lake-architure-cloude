import { REDIS_KEY_PREFIX } from '@/config';
import { Worker, type Job } from 'bullmq';
import { AppError } from '@/errors';
import { getQueueConnection } from '@/lib/infra/queue';
import { logger } from '@/lib/logger';
import { SparkJobRunner } from '@/lib/infra/spark';
import { resolveDataset } from '@/modules/datasets/types';
import { SilverJobRepository } from '../repositories';
import { SILVER_QUEUE_NAME, type SilverJobPayload } from '../queues/silver.queue';

export interface SilverTransformResult {
  rowsTransformed: number;
  bytesProcessed: number;
  deltaVersion?: number;
  datasetId?: string;
}

/**
 * Silver transform executor.
 *
 * MASTER PLAN §05.3 / PHASE 1 task 3: the transformation must run the real
 * business rules and write a real Delta version. The previous implementation
 * copied Bronze rows into a DuckDB table (`SELECT *`), which is neither a
 * transformation nor a Delta write.
 *
 * The actual cleansing (dedup on the natural key, email/age validation,
 * status normalisation, derived columns) lives in the Python/Spark
 * transformers, which own the Delta write. The worker only owns the
 * lifecycle and the bookkeeping.
 */
export async function processTransform(payload: SilverJobPayload): Promise<SilverTransformResult> {
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

  const target = resolveDataset({
    provider: 'local_delta_minio',
    layer: 'silver',
    database: payload.database,
    table: payload.table,
  });
  const sourceTable = payload.sourceTable ?? payload.table;

  const response = await SparkJobRunner.run({
    operation: 'silver.transform',
    jobId: payload.jobId,
    params: {
      targetTable: target.table,
      database: target.database,
      sourceTable,
      mode: payload.kind,
    },
  });

  if (response.status !== 'succeeded') {
    throw new AppError(
      500,
      'SILVER_TRANSFORM_FAILED',
      response.error ?? `Silver transform of ${payload.database}.${payload.table} failed.`,
    );
  }

  const result: SilverTransformResult = {
    rowsTransformed: response.rows,
    bytesProcessed: response.bytes,
  };
  const deltaVersion = response.dataset?.deltaVersion;
  if (deltaVersion !== null && deltaVersion !== undefined) {
    result.deltaVersion = deltaVersion;
  }
  if (response.dataset) {
    result.datasetId = `${response.dataset.provider}/${response.dataset.layer}.${response.dataset.database}.${response.dataset.table}`;
  }
  logger.info(
    { jobId: payload.jobId, rows: result.rowsTransformed, deltaVersion: result.deltaVersion },
    'Silver transform committed',
  );
  return result;
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
            ...(result.deltaVersion !== undefined ? { deltaVersion: result.deltaVersion } : {}),
            ...(result.datasetId ? { datasetId: result.datasetId } : {}),
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
      { connection: getQueueConnection(), prefix: REDIS_KEY_PREFIX, concurrency: 2 },
    );
  },
};
