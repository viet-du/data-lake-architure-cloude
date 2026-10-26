import { AppError } from '@/errors';
import { logger } from '@/lib/logger';
import { SparkJobRunner, type JobOperation } from '@/lib/infra/spark';
import { resolveDataset } from '@/modules/datasets/types';
import type { BronzeJobPayload } from '../queues/bronze.queue';

export interface BronzeExecutionResult {
  rowsIngested: number;
  bytesProcessed: number;
  /** Delta snapshot version produced by the write, when known. */
  deltaVersion?: number;
  /** Canonical dataset id of the produced dataset. */
  datasetId?: string;
}

/**
 * Bronze ingestion executors.
 *
 * MASTER PLAN §05.2 / PHASE 1 task 2: the executors must run a *real*
 * pipeline. Spark is not allowed to run inside an HTTP request, so the
 * executor delegates to the typed Python job runner
 * (:mod:`lakehouse.jobs.runner`) which owns the Delta write.
 *
 * The bridge never invents success: when the runner reports `failed`, the
 * executor raises and the job is marked failed.
 */

const KIND_TO_OPERATION: Record<BronzeJobPayload['kind'], JobOperation> = {
  csv: 'bronze.ingest_csv',
  json: 'bronze.ingest_json',
  stream: 'bronze.ingest_stream',
};

async function runBronzeJob(
  payload: BronzeJobPayload,
  params: Record<string, unknown>,
): Promise<BronzeExecutionResult> {
  const operation = KIND_TO_OPERATION[payload.kind];
  if (!operation) {
    throw new AppError(400, 'UNSUPPORTED_INGEST_KIND', `Unsupported ingest kind: ${payload.kind}`);
  }

  const response = await SparkJobRunner.run({
    operation,
    jobId: payload.jobId,
    params,
  });

  if (response.status !== 'succeeded') {
    // A failed run never wrote a dataset. The message keeps the "no data was
    // written" contract so the job state machine and the operator log agree
    // on what actually happened.
    throw new AppError(
      500,
      'BRONZE_INGEST_FAILED',
      `Bronze ${payload.kind} ingestion failed; no data was written. ${
        response.error ?? ''
      }`.trim(),
    );
  }

  if (response.rows <= 0) {
    // A no-op ingestion must never be reported as a successful commit: the
    // Delta table would not exist and the catalog would point at nothing.
    throw new AppError(
      500,
      'BRONZE_INGEST_EMPTY',
      `Bronze ${payload.kind} ingestion produced 0 rows; no data was written.`,
    );
  }

  const dataset = response.dataset;
  const result: BronzeExecutionResult = {
    rowsIngested: response.rows,
    bytesProcessed: response.bytes,
  };
  if (dataset?.deltaVersion !== null && dataset?.deltaVersion !== undefined) {
    result.deltaVersion = dataset.deltaVersion;
  }
  if (dataset) {
    result.datasetId = `${dataset.provider}/${dataset.layer}.${dataset.database}.${dataset.table}`;
  }
  logger.info(
    {
      jobId: payload.jobId,
      operation,
      rows: response.rows,
      bytes: response.bytes,
      deltaVersion: result.deltaVersion,
      datasetId: result.datasetId,
    },
    'Bronze ingestion committed',
  );
  return result;
}

export async function processCsvIngest(payload: BronzeJobPayload): Promise<BronzeExecutionResult> {
  if (!payload.source) throw new Error('CSV ingest requires source path');
  const ref = resolveDataset({
    provider: 'local_delta_minio',
    layer: 'bronze',
    database: payload.database,
    table: payload.table,
  });
  return runBronzeJob(payload, {
    source: payload.source,
    database: ref.database,
    table: ref.table,
    ...(payload.options ? { options: payload.options } : {}),
  });
}

export async function processJsonIngest(payload: BronzeJobPayload): Promise<BronzeExecutionResult> {
  if (!payload.source) throw new Error('JSON ingest requires source path');
  const ref = resolveDataset({
    provider: 'local_delta_minio',
    layer: 'bronze',
    database: payload.database,
    table: payload.table,
  });
  return runBronzeJob(payload, {
    source: payload.source,
    database: ref.database,
    table: ref.table,
  });
}

export async function processStreamIngest(payload: BronzeJobPayload): Promise<BronzeExecutionResult> {
  if (!payload.topic) throw new Error('Stream ingest requires Kafka topic');
  const ref = resolveDataset({
    provider: 'local_delta_minio',
    layer: 'bronze',
    database: payload.database,
    table: payload.table,
  });
  return runBronzeJob(payload, {
    topic: payload.topic,
    database: ref.database,
    table: ref.table,
    ...(payload.consumerGroup ? { consumerGroup: payload.consumerGroup } : {}),
    ...(payload.maxMessages ? { maxMessages: payload.maxMessages } : {}),
    ...(payload.timeoutMs ? { timeoutMs: payload.timeoutMs } : {}),
  });
}
