import { apiClient } from '../api';
import { ENDPOINTS } from '../api/endpoints';
import type { ApiResponse } from '@/types/commons';
import type { HealthResponse, HealthDeepResponse, HealthInfo } from '@/types/entities';

export const healthService = {
  getHealth: async (): Promise<HealthResponse> => {
    const res = await apiClient.get<ApiResponse<HealthResponse>>(
      ENDPOINTS.health.root,
    );
    return res.data.data;
  },

  getDeepHealth: async (): Promise<HealthDeepResponse> => {
    const res = await apiClient.get<ApiResponse<HealthDeepResponse>>(
      ENDPOINTS.health.deep,
    );
    return res.data.data;
  },

  getInfo: async (): Promise<HealthInfo> => {
    const res = await apiClient.get<ApiResponse<HealthInfo>>(ENDPOINTS.info.root);
    return res.data.data;
  },
};
