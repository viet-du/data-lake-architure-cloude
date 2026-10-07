import { z } from 'zod';

export const BusinessMetricsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});

export type TBusinessMetricsQuery = z.infer<typeof BusinessMetricsQuerySchema>;

export const CustomerAnalyticsQuerySchema = z.object({
  segment: z
    .enum(['Champion', 'Loyal', 'Active', 'At Risk', 'Lost', 'all'])
    .default('all'),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});

export type TCustomerAnalyticsQuery = z.infer<typeof CustomerAnalyticsQuerySchema>;

export const ProductPerformanceQuerySchema = z.object({
  category: z.string().max(120).optional(),
  days: z.coerce.number().int().min(1).max(365).default(90),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});

export type TProductPerformanceQuery = z.infer<typeof ProductPerformanceQuerySchema>;

export const CategoryRevenueQuerySchema = z.object({
  parent_category: z.string().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});

export type TCategoryRevenueQuery = z.infer<typeof CategoryRevenueQuerySchema>;

export const AdHocQuerySchema = z.object({
  sql: z
    .string()
    .min(1)
    .max(10_000)
    .regex(/^[A-Za-z0-9_\s\.,\(\)\*=<>!\-\+\'\"\;\:\$\?\&\|%@`\[\]]+$/),
  limit: z.coerce.number().int().min(1).max(10_000).default(1000),
});

export type TAdHocQuery = z.infer<typeof AdHocQuerySchema>;