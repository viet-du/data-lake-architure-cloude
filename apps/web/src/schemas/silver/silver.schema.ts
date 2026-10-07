import { z } from 'zod';
import { apiResponseSchema, healthStatusSchema } from '../commons.schema';

export const silverFormatSchema = z.enum(['delta', 'parquet']);
export const silverJobStatusSchema = z.enum(['queued', 'running', 'success', 'failed', 'cancelled']);
export const silverOperationSchema = z.enum(['WRITE', 'MERGE', 'DELETE', 'OPTIMIZE', 'REFRESH']);

export const silverTableSchema = z.object({
  name: z.string().min(1),
  database: z.string().min(1),
  format: silverFormatSchema,
  sizeBytes: z.number().nonnegative(),
  rowCount: z.number().nonnegative(),
  partitionBy: z.array(z.string()),
  sourceTable: z.string().optional(),
  transformRule: z.string().optional(),
  lastTransformedAt: z.string().optional(),
  status: healthStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const silverTableStatsSchema = z.object({
  name: z.string(),
  sizeBytes: z.number().nonnegative(),
  rowCount: z.number().nonnegative(),
  fileCount: z.number().int().nonnegative(),
  partitionCount: z.number().int().nonnegative(),
  avgFileSizeBytes: z.number().nonnegative(),
  dedupRate: z.number().min(0).max(1),
  nullRate: z.number().min(0).max(1),
});

export const silverTableHistorySchema = z.object({
  version: z.number().int().nonnegative(),
  timestamp: z.string(),
  operation: silverOperationSchema,
  recordsAffected: z.number().int(),
  transformRule: z.string().optional(),
  userName: z.string().optional(),
});

export const silverTableSampleSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.record(z.unknown())),
  totalRows: z.number().int().nonnegative(),
  sampledAt: z.string(),
});

export const silverTransformJobSchema = z.object({
  jobId: z.string(),
  table: z.string(),
  status: silverJobStatusSchema,
  transformRule: z.string().optional(),
  recordsProcessed: z.number().int().nonnegative(),
  recordsInserted: z.number().int().nonnegative(),
  recordsUpdated: z.number().int().nonnegative(),
  recordsDeleted: z.number().int().nonnegative(),
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  errorMessage: z.string().optional(),
});

export const silverTimeTravelSchema = z.object({
  version: z.number().int().nonnegative(),
  timestamp: z.string(),
  data: z.array(z.record(z.unknown())),
});

export const silverTableDiffSchema = z.object({
  table: z.string(),
  v1: z.number().int().nonnegative(),
  v2: z.number().int().nonnegative(),
  addedRows: z.number().int().nonnegative(),
  removedRows: z.number().int().nonnegative(),
  changedRows: z.number().int().nonnegative(),
  sample: z.array(z.record(z.unknown())),
});

export const silverJobsStatsSchema = z.object({
  total: z.number().int().nonnegative(),
  queued: z.number().int().nonnegative(),
  running: z.number().int().nonnegative(),
  success: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  cancelled: z.number().int().nonnegative(),
  totalRecordsProcessed: z.number().nonnegative(),
});

export const listSilverTablesParamsSchema = z.object({
  database: z.string().optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional(),
});

export const listSilverTablesResultSchema = z.object({
  items: z.array(silverTableSchema),
  total: z.number().int().nonnegative(),
});

export const silverRefreshPayloadSchema = z.object({
  fullRefresh: z.boolean().optional(),
  partitionFilter: z.string().optional(),
});

export const silverTransformPayloadSchema = z.object({
  sourceTable: z.string().min(1, 'sourceTable is required'),
  transformRule: z.string().min(1, 'transformRule is required'),
  mode: z.enum(['full', 'incremental']).optional(),
});

export const silverTablesResponseSchema = apiResponseSchema(listSilverTablesResultSchema);
export const silverTableResponseSchema = apiResponseSchema(silverTableSchema);
export const silverTableStatsResponseSchema = apiResponseSchema(silverTableStatsSchema);
export const silverTableHistoryResponseSchema = apiResponseSchema(z.array(silverTableHistorySchema));
export const silverTablePartitionsResponseSchema = apiResponseSchema(
  z.array(
    z.object({
      partition: z.string(),
      sizeBytes: z.number().nonnegative(),
      rowCount: z.number().nonnegative(),
      fileCount: z.number().int().nonnegative(),
      createdAt: z.string(),
    }),
  ),
);
export const silverTableDiffResponseSchema = apiResponseSchema(silverTableDiffSchema);
export const silverTimeTravelResponseSchema = apiResponseSchema(silverTimeTravelSchema);
export const silverJobsResponseSchema = apiResponseSchema(z.array(silverTransformJobSchema));
export const silverJobStatsResponseSchema = apiResponseSchema(silverJobsStatsSchema);
export const silverTransformJobResponseSchema = apiResponseSchema(silverTransformJobSchema);
