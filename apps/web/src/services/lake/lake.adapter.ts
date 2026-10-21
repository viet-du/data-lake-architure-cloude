import { z } from 'zod';

const summarySchema = z.object({ table: z.string(), database: z.string(), name: z.string() });
const detailSchema = summarySchema.extend({
  rowCount: z.number(), sizeBytes: z.number().nullable(), lastModified: z.string().nullable(),
  partitions: z.array(z.object({ column: z.string(), value: z.string() })),
});
const jobSchema = z.object({
  jobId: z.string(), table: z.string(), database: z.string(), kind: z.string(),
  status: z.enum(['queued', 'running', 'completed', 'failed', 'cancelled']),
  rowCount: z.number(), bytesProcessed: z.number(), startedAt: z.string(),
  finishedAt: z.string().optional(), durationMs: z.number().optional(), errorMessage: z.string().optional(),
});
const statsSchema = z.object({
  total: z.number(), queued: z.number(), running: z.number(), completed: z.number(), failed: z.number(),
  cancelled: z.number(), totalRowsIngested: z.number().optional(), totalBytesProcessed: z.number().optional(),
  totalRowsTransformed: z.number().optional(), totalRowsAggregated: z.number().optional(),
});

export function decodeLayerList(input: unknown) {
  const values = z.array(summarySchema).parse(input);
  return { items: values.map((v) => ({ ...v, name: v.table })), total: values.length };
}

export function decodeLayerDetail(input: unknown) {
  const value = detailSchema.parse(input);
  return {
    ...value, name: value.table, format: 'delta' as const, partitionBy: [...new Set(value.partitions.map((p) => p.column))],
    updatedAt: value.lastModified, status: 'unknown' as const,
  };
}

export function decodeJob(input: unknown) {
  const value = jobSchema.parse(input);
  return { ...value, status: value.status === 'completed' ? 'success' as const : value.status };
}

export function decodeJobs(input: unknown) {
  return z.object({ items: z.array(z.unknown()), total: z.number() }).parse(input).items.map(decodeJob);
}

export function decodeJobStats(input: unknown) {
  const value = statsSchema.parse(input);
  return { ...value, success: value.completed };
}

export function decodeSample(input: unknown) {
  const rows = z.array(z.record(z.unknown())).parse(input);
  return { rows, columns: [...new Set(rows.flatMap((row) => Object.keys(row)))], totalRows: rows.length };
}
export function decodeTableStats(input: unknown) {
  const value = z.object({ table: z.string(), sizeBytes: z.number().nullable(), rowCount: z.number(), fileCount: z.number().nullable(), partitionCount: z.number() }).parse(input);
  return { ...value, name: value.table, avgFileSizeBytes: value.fileCount !== null && value.sizeBytes !== null ? (value.fileCount > 0 ? value.sizeBytes / value.fileCount : 0) : null };
}
export function decodeHistory(input: unknown) {
  return z.array(z.object({ version: z.number(), timestamp: z.string(), operation: z.string(), user: z.string() })).parse(input).map((entry) => ({ ...entry, userName: entry.user }));
}
