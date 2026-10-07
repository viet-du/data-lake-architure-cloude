import { NotFoundError } from '@/errors';
import { BronzeJobRepository } from '../repositories/bronze-job.repository';
import { BronzeQueue } from '../queues/bronze.queue';
import type { BronzeJob, BronzeJobStats } from '../types';
import type { TJobIdParams, TJobListQuery } from '../schemas';
import { randomUUID } from 'crypto';

export const BronzeJobService = {
  async getOrFail(params: TJobIdParams): Promise<BronzeJob> {
    const job = await BronzeJobRepository.findByJobId(params.jobId);
    if (!job) throw new NotFoundError('Job', params.jobId);
    return job;
  },

  async list(query: TJobListQuery): Promise<{ total: number; items: BronzeJob[] }> {
    const items = await BronzeJobRepository.list({
      limit: query.limit,
      offset: query.offset,
      ...(query.status ? { status: query.status } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.database ? { database: query.database } : {}),
      ...(query.table ? { table: query.table } : {}),
    });
    return { total: items.length, items };
  },

  async stats(): Promise<BronzeJobStats> {
    return BronzeJobRepository.stats();
  },

  async cancel(params: TJobIdParams): Promise<{ jobId: string; cancelled: boolean }> {
    const job = await this.getOrFail(params);
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      await BronzeJobRepository.update(params.jobId, {
        status: 'cancelled',
        finishedAt: new Date().toISOString(),
      });
      return { jobId: params.jobId, cancelled: true };
    }
    const removed = await BronzeQueue.cancel(params.jobId);
    await BronzeJobRepository.update(params.jobId, {
      status: 'cancelled',
      finishedAt: new Date().toISOString(),
    });
    return { jobId: params.jobId, cancelled: removed };
  },

  async delete(params: TJobIdParams): Promise<void> {
    const job = await this.getOrFail(params);
    await BronzeQueue.cancel(job.jobId);
    await BronzeJobRepository.delete(params.jobId);
  },

  generateJobId(): string {
    return `bronze-${Date.now()}-${randomUUID().slice(0, 8)}`;
  },
};