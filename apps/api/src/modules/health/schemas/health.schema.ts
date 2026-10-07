import { z } from 'zod';

export const ServiceStatusSchema = z.object({
  status: z.enum(['up', 'down', 'degraded', 'skipped']),
  latencyMs: z.number().optional(),
  message: z.string().optional(),
  details: z.unknown(),
});

export type TServiceStatus = z.infer<typeof ServiceStatusSchema>;

export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded', 'down']),
  timestamp: z.string(),
  uptime: z.number(),
  services: z.array(ServiceStatusSchema),
});

export type THealthResponse = z.infer<typeof HealthResponseSchema>;

export const AppInfoResponseSchema = z.object({
  name: z.string(),
  version: z.string(),
  env: z.string(),
  nodeVersion: z.string(),
  uptime: z.number(),
  timestamp: z.string(),
});

export type TAppInfoResponse = z.infer<typeof AppInfoResponseSchema>;