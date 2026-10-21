import { z } from 'zod';
import { apiClient } from '../api';
import { ENDPOINTS } from '../api/endpoints';
import type { ApiResponse } from '@/types/commons';
import type { HealthResponse, HealthDeepResponse, HealthInfo } from '@/types/entities';

const healthSchema = z.object({
  status: z.enum(['ok', 'degraded', 'down']),
  uptime: z.number(),
  timestamp: z.string(),
  services: z.array(z.object({
    name: z.string(), status: z.enum(['up', 'down', 'degraded', 'skipped']),
    latencyMs: z.number().optional(), message: z.string().optional(),
  })),
});

export function decodeHealth(input: unknown): HealthResponse {
  const value = healthSchema.parse(input);
  return {
    status: value.status === 'ok' ? 'healthy' : value.status === 'down' ? 'unhealthy' : 'degraded',
    uptime: Math.floor(value.uptime / 1000),
    timestamp: value.timestamp,
    services: value.services.map((service) => ({
      name: service.name,
      status: service.status === 'up' ? 'healthy' : service.status === 'down' ? 'unhealthy' : service.status === 'skipped' ? 'unknown' : 'degraded',
      lastCheckedAt: value.timestamp,
      ...(service.message ? { message: service.message } : {}),
      ...(service.latencyMs !== undefined ? { durationMs: service.latencyMs } : {}),
    })),
  };
}

export const healthService = {
  getHealth: async (): Promise<HealthResponse> => {
    const res = await apiClient.get<ApiResponse<unknown>>(ENDPOINTS.health.root);
    return decodeHealth(res.data.data);
  },
  getDeepHealth: async (): Promise<HealthDeepResponse> => {
    const res = await apiClient.get<ApiResponse<unknown>>(ENDPOINTS.health.deep);
    return decodeHealth(res.data.data);
  },
  getInfo: async (): Promise<HealthInfo> => {
    const res = await apiClient.get<ApiResponse<HealthInfo>>(ENDPOINTS.info.root);
    const value = z.object({ name: z.string(), version: z.string(), env: z.string(), dataSource: z.enum(['local', 'databricks']).default('local'), catalog: z.string().nullable().default(null), workspaceId: z.string().nullable().default(null), readOnly: z.boolean().default(false) }).parse(res.data.data);
    return { appName: value.name, version: value.version, environment: value.env, dataSource: value.dataSource, catalog: value.catalog, workspaceId: value.workspaceId, readOnly: value.readOnly };
  },
};
