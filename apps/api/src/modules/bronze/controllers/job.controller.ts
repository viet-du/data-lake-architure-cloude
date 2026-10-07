import { BronzeJobService } from '../services/job.service';
import type { BronzeJob, BronzeJobStats } from '../types';
import type { TJobIdParams, TJobListQuery } from '../schemas';

export const BronzeJobController = {
  async get(params: TJobIdParams): Promise<BronzeJob> {
    return BronzeJobService.getOrFail(params);
  },

  async list(query: TJobListQuery): Promise<{ total: number; items: BronzeJob[] }> {
    return BronzeJobService.list(query);
  },

  async stats(): Promise<BronzeJobStats> {
    return BronzeJobService.stats();
  },

  async cancel(params: TJobIdParams): Promise<{ jobId: string; cancelled: boolean }> {
    return BronzeJobService.cancel(params);
  },

  async delete(params: TJobIdParams): Promise<void> {
    return BronzeJobService.delete(params);
  },
};