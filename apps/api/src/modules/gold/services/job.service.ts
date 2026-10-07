import { NotFoundError } from '@/errors';
import { GoldJobRepository } from '../repositories/gold-job.repository';
import { GoldQueue } from '../queues/gold.queue';
import type { GoldJob, GoldJobStats } from '../types';
import type { TJobIdParams, TJobListQuery } from '../schemas';
import { randomUUID } from 'crypto';

export const GoldJobService = {
  async getOrFail(params: TJobIdParams): Promise<GoldJob> {
    const job = await GoldJobRepository.findByJobId(params.jobId);
    if (!job) throw new NotFoundError('Job', params.jobId);
    return job;
  },

  async list(query: TJobListQuery): Promise<{ total: number; items: GoldJob[] }> {
    const items = await GoldJobRepository.list({
      limit: query.limit,
      offset: query.offset,
      ...(query.status ? { status: query.status } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.database ? { database: query.database } : {}),
      ...(query.table ? { table: query.table } : {}),
    });
    return { total: items.length, items };
  },

  async stats(): Promise<GoldJobStats> {
    return GoldJobRepository.stats();
  },

  async cancel(params: TJobIdParams): Promise<{ jobId: string; cancelled: boolean }> {
    const job = await this.getOrFail(params);
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      await GoldJobRepository.update(params.jobId, {
        status: 'cancelled',
        finishedAt: new Date().toISOString(),
      });
      return { jobId: params.jobId, cancelled: true };
    }
    const removed = await GoldQueue.cancel(params.jobId);
    await GoldJobRepository.update(params.jobId, {
      status: 'cancelled',
      finishedAt: new Date().toISOString(),
    });
    return { jobId: params.jobId, cancelled: removed };
  },

  async delete(params: TJobIdParams): Promise<void> {
    const job = await this.getOrFail(params);
    await GoldQueue.cancel(job.jobId);
    await GoldJobRepository.delete(params.jobId);
  },

  generateJobId(): string {
    return `gold-${Date.now()}-${randomUUID().slice(0, 8)}`;
  },
};