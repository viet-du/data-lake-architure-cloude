import { z } from 'zod';

export const ServiceStatusSchema = z.object({
  name: z.string(),
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
  dataSource: z.enum(['local', 'databricks']),
  /**
   * Where ETL/ELT mutations actually execute.
   *
   * MASTER PLAN §02.2 / §09: the execution target is a separate decision from
   * the read source, so both are reported and never conflated.
   */
  executionTarget: z.enum(['local_delta_minio', 'databricks_uc']),
  catalog: z.string().nullable(),
  workspaceId: z.string().nullable(),
  /** True when the *execution target* rejects mutations. */
  readOnly: z.boolean(),
  name: z.string(),
  version: z.string(),
  env: z.string(),
  nodeVersion: z.string(),
  uptime: z.number(),
  timestamp: z.string(),
});

export type TAppInfoResponse = z.infer<typeof AppInfoResponseSchema>;