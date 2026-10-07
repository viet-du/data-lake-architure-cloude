import { SilverJobService } from '../services/job.service';
import type { SilverJob, SilverJobStats } from '../types';
import type { TJobIdParams, TJobListQuery } from '../schemas';

export const SilverJobController = {
  async get(params: TJobIdParams): Promise<SilverJob> {
    return SilverJobService.getOrFail(params);
  },

  async list(query: TJobListQuery): Promise<{ total: number; items: SilverJob[] }> {
    return SilverJobService.list(query);
  },

  async stats(): Promise<SilverJobStats> {
    return SilverJobService.stats();
  },

  async cancel(params: TJobIdParams): Promise<{ jobId: string; cancelled: boolean }> {
    return SilverJobService.cancel(params);
  },

  async delete(params: TJobIdParams): Promise<void> {
    return SilverJobService.delete(params);
  },
};