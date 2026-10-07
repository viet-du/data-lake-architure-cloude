import { z } from 'zod';
import { apiResponseSchema, healthStatusSchema } from '../commons.schema';

export const bronzeFormatSchema = z.enum(['delta', 'parquet', 'csv', 'json']);
export const bronzeJobStatusSchema = z.enum(['queued', 'running', 'success', 'failed', 'cancelled']);
export const bronzeIngestSourceSchema = z.enum(['json', 'csv', 'kafka']);
export const bronzeOperationSchema = z.enum(['WRITE', 'DELETE', 'OPTIMIZE', 'VACUUM']);

export const bronzeTableSchema = z.object({
  name: z.string().min(1),
  database: z.string().min(1),
  format: bronzeFormatSchema,
  sizeBytes: z.number().nonnegative(),
  rowCount: z.number().nonnegative(),
  partitionBy: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastIngestedAt: z.string().optional(),
  status: healthStatusSchema,
  location: z.string().optional(),
});

export const bronzeTableStatsSchema = z.object({
  name: z.string(),
  sizeBytes: z.number().nonnegative(),
  rowCount: z.number().nonnegative(),
  fileCount: z.number().int().nonnegative(),
  partitionCount: z.number().int().nonnegative(),
  avgFileSizeBytes: z.number().nonnegative(),
  lastVacuumedAt: z.string().optional(),
});

export const bronzeTableHistorySchema = z.object({
  version: z.number().int().nonnegative(),
  timestamp: z.string(),
  operation: bronzeOperationSchema,
  recordsAdded: z.number().int(),
  recordsRemoved: z.number().int(),
  userName: z.string().optional(),
});

export const bronzeTablePartitionSchema = z.object({
  partition: z.string(),
  sizeBytes: z.number().nonnegative(),
  rowCount: z.number().nonnegative(),
  fileCount: z.number().int().nonnegative(),
  createdAt: z.string(),
});

export const bronzeTableSampleSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.record(z.unknown())),
  totalRows: z.number().int().nonnegative(),
  sampledAt: z.string(),
});

export const bronzeIngestJobSchema = z.object({
  jobId: z.string(),
  table: z.string(),
  status: bronzeJobStatusSchema,
  source: bronzeIngestSourceSchema,
  recordsIngested: z.number().int().nonnegative(),
  bytesIngested: z.number().nonnegative(),
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  errorMessage: z.string().optional(),
});

export const bronzeJobsStatsSchema = z.object({
  total: z.number().int().nonnegative(),
  queued: z.number().int().nonnegative(),
  running: z.number().int().nonnegative(),
  success: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  cancelled: z.number().int().nonnegative(),
  totalRecordsIngested: z.number().nonnegative(),
  totalBytesIngested: z.number().nonnegative(),
});

export const listBronzeTablesParamsSchema = z.object({
  database: z.string().optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional(),
});

export const listBronzeTablesResultSchema = z.object({
  items: z.array(bronzeTableSchema),
  total: z.number().int().nonnegative(),
});

export const ingestJsonPayloadSchema = z.object({
  table: z.string().min(1, 'table is required'),
  database: z.string().min(1, 'database is required'),
  data: z.array(z.record(z.unknown())).min(1, 'data must contain at least one row'),
  mode: z.enum(['append', 'overwrite', 'merge']).optional(),
});

export const ingestCsvPayloadSchema = z.object({
  table: z.string().min(1, 'table is required'),
  database: z.string().min(1, 'database is required'),
  fileUrl: z.string().url('fileUrl must be a valid URL'),
  delimiter: z.string().max(1).optional(),
  hasHeader: z.boolean().optional(),
  mode: z.enum(['append', 'overwrite']).optional(),
});

export const ingestStreamPayloadSchema = z.object({
  database: z.string().min(1, 'database is required'),
  table: z.string().min(1, 'table is required'),
  checkpointLocation: z.string().optional(),
});

export const vacuumPayloadSchema = z.object({
  retentionDays: z.number().int().min(0).optional(),
  dryRun: z.boolean().optional(),
});

export const bronzeTablesResponseSchema = apiResponseSchema(listBronzeTablesResultSchema);
export const bronzeTableResponseSchema = apiResponseSchema(bronzeTableSchema);
export const bronzeTableStatsResponseSchema = apiResponseSchema(bronzeTableStatsSchema);
export const bronzeTableHistoryResponseSchema = apiResponseSchema(z.array(bronzeTableHistorySchema));
export const bronzeTablePartitionsResponseSchema = apiResponseSchema(z.array(bronzeTablePartitionSchema));
export const bronzeJobsResponseSchema = apiResponseSchema(z.array(bronzeIngestJobSchema));
export const bronzeJobStatsResponseSchema = apiResponseSchema(bronzeJobsStatsSchema);
export const bronzeIngestJobResponseSchema = apiResponseSchema(bronzeIngestJobSchema);
