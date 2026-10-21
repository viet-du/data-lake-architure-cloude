import { Worker } from 'bullmq';
import { REDIS_KEY_PREFIX } from '@/config';
import { getQueueConnection } from '@/lib/infra/queue';
import { BronzeJobRepository } from '../repositories';
import { BRONZE_QUEUE_NAME, type BronzeJobPayload } from '../queues/bronze.queue';
import { processCsvIngest, processJsonIngest, processStreamIngest } from './bronze-executors';

export async function processBronzeJob(payload: BronzeJobPayload, attemptsMade: number) {
  await BronzeJobRepository.update(payload.jobId, { status: 'running', attemptsMade });
  try {
    const executor = { csv: processCsvIngest, json: processJsonIngest, stream: processStreamIngest }[payload.kind];
    if (!executor) throw new Error(`Unsupported Bronze ingest kind: ${payload.kind}`);
    const result = await executor(payload);
    await BronzeJobRepository.update(payload.jobId, {
      status: 'completed', rowCount: result.rowsIngested,
      bytesProcessed: result.bytesProcessed, finishedAt: new Date().toISOString(),
    });
    return result;
  } catch (error) {
    await BronzeJobRepository.update(payload.jobId, {
      status: 'failed', errorMessage: error instanceof Error ? error.message : String(error),
      finishedAt: new Date().toISOString(),
    });
    throw error;
  }
}

export const BronzeWorker = {
  start(): Worker<BronzeJobPayload> {
    return new Worker<BronzeJobPayload>(BRONZE_QUEUE_NAME,
      (job) => processBronzeJob(job.data, job.attemptsMade),
      { connection: getQueueConnection(), prefix: REDIS_KEY_PREFIX, concurrency: 2 });
  },
};
