import type { EHealthStatus } from '@/types/commons';

export type ESilverJobStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled';

export interface SilverTable {
  name: string;
  database: string;
  format: 'delta' | 'parquet';
  sizeBytes: number;
  rowCount: number;
  partitionBy: ReadonlyArray<string>;
  sourceTable?: string;
  transformRule?: string;
  lastTransformedAt?: string;
  status: EHealthStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SilverTableStats {
  name: string;
  sizeBytes: number;
  rowCount: number;
  fileCount: number;
  partitionCount: number;
  avgFileSizeBytes: number;
  dedupRate: number;
  nullRate: number;
}

export interface SilverTableHistory {
  version: number;
  timestamp: string;
  operation: 'WRITE' | 'MERGE' | 'DELETE' | 'OPTIMIZE' | 'REFRESH';
  recordsAffected: number;
  transformRule?: string;
  userName?: string;
}

export interface SilverTableSample {
  columns: ReadonlyArray<string>;
  rows: ReadonlyArray<Readonly<Record<string, unknown>>>;
  totalRows: number;
  sampledAt: string;
}

export interface SilverTransformJob {
  jobId: string;
  table: string;
  status: ESilverJobStatus;
  transformRule?: string;
  recordsProcessed: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsDeleted: number;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  errorMessage?: string;
}

export interface SilverTimeTravel {
  version: number;
  timestamp: string;
  data: ReadonlyArray<Readonly<Record<string, unknown>>>;
}

export interface SilverTableDiff {
  table: string;
  v1: number;
  v2: number;
  addedRows: number;
  removedRows: number;
  changedRows: number;
  sample: ReadonlyArray<Readonly<Record<string, unknown>>>;
}

export interface SilverJobsStats {
  total: number;
  queued: number;
  running: number;
  success: number;
  failed: number;
  cancelled: number;
  totalRecordsProcessed: number;
}
