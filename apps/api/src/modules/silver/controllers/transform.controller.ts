import { SilverTransformService } from '../services/transform.service';
import type { SilverJob } from '../types';
import type { TTableParams, TTransformBody, TTransformAllBody, TRefreshBody } from '../schemas';

export const SilverTransformController = {
  async transformOne(params: TTableParams, body: TTransformBody): Promise<SilverJob> {
    return SilverTransformService.transformOne(params, body);
  },

  async transformAll(body: TTransformAllBody): Promise<{ total: number; items: SilverJob[] }> {
    return SilverTransformService.transformAll(body);
  },

  async refresh(params: TTableParams, body: TRefreshBody): Promise<SilverJob> {
    return SilverTransformService.refresh(params, body);
  },
};