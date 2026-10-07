import { GoldAggregateService } from '../services/aggregate.service';
import type { GoldJob } from '../types';
import type {
  TTableParams,
  TAggregateBody,
  TAggregateAllBody,
  TRefreshBody,
} from '../schemas';

export const GoldAggregateController = {
  async aggregateOne(params: TTableParams, body: TAggregateBody): Promise<GoldJob> {
    return GoldAggregateService.aggregateOne(params, body);
  },

  async aggregateAll(body: TAggregateAllBody): Promise<{ total: number; items: GoldJob[] }> {
    return GoldAggregateService.aggregateAll(body);
  },

  async refresh(params: TTableParams, body: TRefreshBody): Promise<GoldJob> {
    return GoldAggregateService.refresh(params, body);
  },
};