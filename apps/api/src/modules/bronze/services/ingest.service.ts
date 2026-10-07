import { BronzeJobRepository } from '../repositories/bronze-job.repository';
import { BronzeQueue } from '../queues/bronze.queue';
import { BronzeJobService } from './job.service';
import { logger } from '@/lib/logger';
import type { BronzeJob } from '../types';
import type {
  TIngestCsvBody,
  TIngestJsonBody,
  TIngestStreamBody,
  TIngestStreamParams,
} from '../schemas';

export const BronzeIngestService = {
  async ingestCsv(body: TIngestCsvBody): Promise<BronzeJob> {
    const jobId = BronzeJobService.generateJobId();
    const job = await BronzeJobRepository.create({
      jobId,
      database: body.database,
      table: body.table,
      kind: 'csv',
      source: body.source,
    });
    await BronzeQueue.add({
      jobId,
      database: body.database,
      table: body.table,
      kind: 'csv',
      source: body.source,
      ...(body.partition ? { partition: body.partition } : {}),
      options: body.options as Record<string, unknown>,
      startedAt: job.startedAt,
    });
    logger.info({ jobId, table: body.table, source: body.source }, 'CSV ingest job enqueued');
    return job;
  },

  async ingestJson(body: TIngestJsonBody): Promise<BronzeJob> {
    const jobId = BronzeJobService.generateJobId();
    const job = await BronzeJobRepository.create({
      jobId,
      database: body.database,
      table: body.table,
      kind: 'json',
      source: body.source,
    });
    await BronzeQueue.add({
      jobId,
      database: body.database,
      table: body.table,
      kind: 'json',
      source: body.source,
      ...(body.partition ? { partition: body.partition } : {}),
      options: body.options as Record<string, unknown>,
      startedAt: job.startedAt,
    });
    logger.info({ jobId, table: body.table, source: body.source }, 'JSON ingest job enqueued');
    return job;
  },

  async ingestStream(params: TIngestStreamParams, body: TIngestStreamBody): Promise<BronzeJob> {
    const jobId = BronzeJobService.generateJobId();
    const job = await BronzeJobRepository.create({
      jobId,
      database: body.database,
      table: body.table,
      kind: 'stream',
      topic: params.topic,
    });
    await BronzeQueue.add({
      jobId,
      database: body.database,
      table: body.table,
      kind: 'stream',
      topic: params.topic,
      consumerGroup: body.consumerGroup,
      maxMessages: body.maxMessages,
      timeoutMs: body.timeoutMs,
      startedAt: job.startedAt,
    });
    logger.info(
      { jobId, table: body.table, topic: params.topic, consumerGroup: body.consumerGroup },
      'Stream ingest job enqueued',
    );
    return job;
  },
};