import { z } from 'zod';
import { SILVER_JOB_STATUSES, SILVER_TRANSFORM_KINDS } from '../types';

export const JobIdParamsSchema = z.object({
  jobId: z.string().min(1).max(255),
});

export type TJobIdParams = z.infer<typeof JobIdParamsSchema>;

export const JobListQuerySchema = z.object({
  status: z.enum(SILVER_JOB_STATUSES).optional(),
  kind: z.enum(SILVER_TRANSFORM_KINDS).optional(),
  database: z.string().optional(),
  table: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type TJobListQuery = z.infer<typeof JobListQuerySchema>;