import { REDIS_KEY_PREFIX } from '@/config';
import { Worker, type Job } from 'bullmq';
import { AppError } from '@/errors';
import { getQueueConnection } from '@/lib/infra/queue';
import { logger } from '@/lib/logger';
import { SparkJobRunner } from '@/lib/infra/spark';
import { resolveDataset } from '@/modules/datasets/types';
import { GoldJobRepository } from '../repositories';
import { GOLD_QUEUE_NAME, type GoldJobPayload } from '../queues/gold.queue';

export interface GoldAggregateResult {
  rowsAggregated: number;
  bytesProcessed: number;
  deltaVersion?: number;
  datasetId?: string;
}

/**
 * Gold aggregation executor.
 *
 * MASTER PLAN §05.3 / PHASE 1 task 3 and test P0-GO-01: the aggregation must
 * apply the real business measures and be reconcilable against a reference
 * fixture. The previous implementation copied Silver rows into a DuckDB
 * table — no grouping, no measure, no Delta write.
 *
 * The business SQL lives in the Python/Spark aggregators (revenue is
 * computed from completed orders only, profit uses the real product cost),
 * and the Delta write is owned by Spark. The worker owns the lifecycle.
 */
export async function processAggregate(payload: GoldJobPayload): Promise<GoldAggregateResult> {
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

  const target = resolveDataset({
    provider: 'local_delta_minio',
    layer: 'gold',
    database: payload.database,
    table: payload.table,
  });
  const sources = payload.sourceTables.length > 0 ? payload.sourceTables : [payload.table];

  const response = await SparkJobRunner.run({
    operation: 'gold.aggregate',
    jobId: payload.jobId,
    params: {
      targetTable: target.table,
      database: target.database,
      sourceTables: sources,
    },
  });

  if (response.status !== 'succeeded') {
    throw new AppError(
      500,
      'GOLD_AGGREGATION_FAILED',
      response.error ?? `Gold aggregation of ${payload.database}.${payload.table} failed.`,
    );
  }

  const result: GoldAggregateResult = {
    rowsAggregated: response.rows,
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
    { jobId: payload.jobId, rows: result.rowsAggregated, deltaVersion: result.deltaVersion },
    'Gold aggregate committed',
  );
  return result;
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
            ...(result.deltaVersion !== undefined ? { deltaVersion: result.deltaVersion } : {}),
            ...(result.datasetId ? { datasetId: result.datasetId } : {}),
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
      { connection: getQueueConnection(), prefix: REDIS_KEY_PREFIX, concurrency: 2 },
    );
  },
};
