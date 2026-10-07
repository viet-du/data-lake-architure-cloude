import { NotFoundError } from '@/errors';
import { SilverJobRepository } from '../repositories/silver-job.repository';
import { SilverQueue } from '../queues/silver.queue';
import type { SilverJob, SilverJobStats } from '../types';
import type { TJobIdParams, TJobListQuery } from '../schemas';
import { randomUUID } from 'crypto';

export const SilverJobService = {
  async getOrFail(params: TJobIdParams): Promise<SilverJob> {
    const job = await SilverJobRepository.findByJobId(params.jobId);
    if (!job) throw new NotFoundError('Job', params.jobId);
    return job;
  },

  async list(query: TJobListQuery): Promise<{ total: number; items: SilverJob[] }> {
    const items = await SilverJobRepository.list({
      limit: query.limit,
      offset: query.offset,
      ...(query.status ? { status: query.status } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.database ? { database: query.database } : {}),
      ...(query.table ? { table: query.table } : {}),
    });
    return { total: items.length, items };
  },

  async stats(): Promise<SilverJobStats> {
    return SilverJobRepository.stats();
  },

  async cancel(params: TJobIdParams): Promise<{ jobId: string; cancelled: boolean }> {
    const job = await this.getOrFail(params);
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      await SilverJobRepository.update(params.jobId, {
        status: 'cancelled',
        finishedAt: new Date().toISOString(),
      });
      return { jobId: params.jobId, cancelled: true };
    }
    const removed = await SilverQueue.cancel(params.jobId);
    await SilverJobRepository.update(params.jobId, {
      status: 'cancelled',
      finishedAt: new Date().toISOString(),
    });
    return { jobId: params.jobId, cancelled: removed };
  },

  async delete(params: TJobIdParams): Promise<void> {
    const job = await this.getOrFail(params);
    await SilverQueue.cancel(job.jobId);
    await SilverJobRepository.delete(params.jobId);
  },

  generateJobId(): string {
    return `silver-${Date.now()}-${randomUUID().slice(0, 8)}`;
  },
};