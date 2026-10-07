import { GoldJobService } from '../services/job.service';
import type { GoldJob, GoldJobStats } from '../types';
import type { TJobIdParams, TJobListQuery } from '../schemas';

export const GoldJobController = {
  async get(params: TJobIdParams): Promise<GoldJob> {
    return GoldJobService.getOrFail(params);
  },

  async list(query: TJobListQuery): Promise<{ total: number; items: GoldJob[] }> {
    return GoldJobService.list(query);
  },

  async stats(): Promise<GoldJobStats> {
    return GoldJobService.stats();
  },

  async cancel(params: TJobIdParams): Promise<{ jobId: string; cancelled: boolean }> {
    return GoldJobService.cancel(params);
  },

  async delete(params: TJobIdParams): Promise<void> {
    return GoldJobService.delete(params);
  },
};