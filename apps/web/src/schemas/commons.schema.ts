import { z } from 'zod';

export const healthStatusSchema = z.enum(['healthy', 'degraded', 'unhealthy']);

export const dateRangeSchema = z.object({
  from: z.string(),
  to: z.string(),
});

export const paginationSchema = z.object({
  page: z.number().int().min(0),
  pageSize: z.number().int().min(1).max(500),
  total: z.number().int().min(0),
});

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
});

export const apiResponseSchema = <T extends z.ZodTypeAny>(data: T) =>
  z.object({
    success: z.boolean(),
    data,
    error: apiErrorSchema.optional(),
    meta: z
      .object({
        page: z.number().optional(),
        pageSize: z.number().optional(),
        total: z.number().optional(),
      })
      .optional(),
  });
