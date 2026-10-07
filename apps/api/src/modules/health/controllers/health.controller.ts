import { HealthService } from '../services';
import type { THealthResponse, TAppInfoResponse } from '../schemas';

export const HealthController = {
  async check(deep: boolean): Promise<THealthResponse> {
    return HealthService.check(deep);
  },

  async info(): Promise<TAppInfoResponse> {
    return HealthService.info();
  },
};