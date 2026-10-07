import { z } from 'zod';
import { apiResponseSchema, healthStatusSchema } from '../commons.schema';

export const goldFormatSchema = z.enum(['delta', 'parquet']);
export const goldJobStatusSchema = z.enum(['queued', 'running', 'success', 'failed', 'cancelled']);
export const goldSourceLayerSchema = z.enum(['silver', 'bronze']);
export const goldAggregateTypeSchema = z.enum(['sum', 'avg', 'count', 'min', 'max', 'group_by']);
export const goldOperationSchema = z.enum(['WRITE', 'APPEND', 'REFRESH', 'OPTIMIZE']);
export const goldMetricOpSchema = z.enum(['sum', 'avg', 'count', 'min', 'max']);

export const goldTableSchema = z.object({
  name: z.string().min(1),
  database: z.string().min(1),
  format: goldFormatSchema,
  sizeBytes: z.number().nonnegative(),
  rowCount: z.number().nonnegative(),
  sourceLayer: goldSourceLayerSchema,
  sourceTables: z.array(z.string()),
  aggregateType: goldAggregateTypeSchema.optional(),
  refreshSchedule: z.string().optional(),
  lastRefreshedAt: z.string().optional(),
  status: healthStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const goldTableStatsSchema = z.object({
  name: z.string(),
  sizeBytes: z.number().nonnegative(),
  rowCount: z.number().nonnegative(),
  fileCount: z.number().int().nonnegative(),
  refreshDurationMs: z.number().int().nonnegative().optional(),
  lastRefreshStatus: goldJobStatusSchema,
  consumerLagSeconds: z.number().nonnegative().optional(),
});

export const goldTableHistorySchema = z.object({
  version: z.number().int().nonnegative(),
  timestamp: z.string(),
  operation: goldOperationSchema,
  recordsAffected: z.number().int(),
  sourceLayer: goldSourceLayerSchema,
  userName: z.string().optional(),
});

export const goldTableSampleSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.record(z.unknown())),
  totalRows: z.number().int().nonnegative(),
  sampledAt: z.string(),
});

export const goldTableLineageSchema = z.object({
  table: z.string(),
  upstream: z.array(
    z.object({
      table: z.string(),
      layer: goldSourceLayerSchema,
      edgeType: z.string(),
    }),
  ),
  downstream: z.array(
    z.object({
      table: z.string(),
      layer: goldSourceLayerSchema,
      edgeType: z.string(),
    }),
  ),
});

export const goldAggregateResultSchema = z.object({
  groupBy: z.array(z.string()),
  metrics: z.array(z.object({ name: z.string(), value: z.number() })),
  totalRows: z.number().int().nonnegative(),
  executionMs: z.number().int().nonnegative(),
});

export const goldAggregateJobSchema = z.object({
  jobId: z.string(),
  table: z.string(),
  status: goldJobStatusSchema,
  aggregateType: z.string(),
  recordsProcessed: z.number().int().nonnegative(),
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  errorMessage: z.string().optional(),
});

export const goldJobsStatsSchema = z.object({
  total: z.number().int().nonnegative(),
  queued: z.number().int().nonnegative(),
  running: z.number().int().nonnegative(),
  success: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  totalRecordsProcessed: z.number().nonnegative(),
  avgRefreshDurationMs: z.number().nonnegative(),
});

export const goldQueryResultSchema = z.object({
  queryName: z.string(),
  columns: z.array(z.string()),
  rows: z.array(z.record(z.unknown())),
  totalRows: z.number().int().nonnegative(),
  executionMs: z.number().int().nonnegative(),
  ranAt: z.string(),
});

export const listGoldTablesParamsSchema = z.object({
  database: z.string().optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional(),
});

export const listGoldTablesResultSchema = z.object({
  items: z.array(goldTableSchema),
  total: z.number().int().nonnegative(),
});

export const aggregatePayloadSchema = z.object({
  groupBy: z.array(z.string().min(1)).min(1, 'groupBy must contain at least one column'),
  metrics: z
    .array(
      z.object({
        name: z.string().min(1, 'metric name is required'),
        op: goldMetricOpSchema,
      }),
    )
    .min(1, 'metrics must contain at least one entry'),
  filters: z.record(z.unknown()).optional(),
});

export const adHocQueryParamsSchema = z.object({
  sql: z.string().min(1, 'SQL is required'),
  limit: z.number().int().min(1).max(1000).optional(),
});

export const goldTablesResponseSchema = apiResponseSchema(listGoldTablesResultSchema);
export const goldTableResponseSchema = apiResponseSchema(goldTableSchema);
export const goldTableStatsResponseSchema = apiResponseSchema(goldTableStatsSchema);
export const goldTableHistoryResponseSchema = apiResponseSchema(z.array(goldTableHistorySchema));
export const goldTableLineageResponseSchema = apiResponseSchema(goldTableLineageSchema);
export const goldAggregateResultResponseSchema = apiResponseSchema(goldAggregateResultSchema);
export const goldJobsResponseSchema = apiResponseSchema(z.array(goldAggregateJobSchema));
export const goldJobStatsResponseSchema = apiResponseSchema(goldJobsStatsSchema);
export const goldQueryResultResponseSchema = apiResponseSchema(goldQueryResultSchema);
