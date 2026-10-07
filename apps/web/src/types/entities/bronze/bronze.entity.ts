import type { EHealthStatus } from '@/types/commons';

export type EBronzeFormat = 'delta' | 'parquet' | 'csv' | 'json';

export type EBronzeJobStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled';

export interface BronzeTable {
  name: string;
  database: string;
  format: EBronzeFormat;
  sizeBytes: number;
  rowCount: number;
  partitionBy: ReadonlyArray<string>;
  createdAt: string;
  updatedAt: string;
  lastIngestedAt?: string;
  status: EHealthStatus;
  location?: string;
}

export interface BronzeTableStats {
  name: string;
  sizeBytes: number;
  rowCount: number;
  fileCount: number;
  partitionCount: number;
  avgFileSizeBytes: number;
  lastVacuumedAt?: string;
}

export interface BronzeTableHistory {
  version: number;
  timestamp: string;
  operation: 'WRITE' | 'DELETE' | 'OPTIMIZE' | 'VACUUM';
  recordsAdded: number;
  recordsRemoved: number;
  userName?: string;
}

export interface BronzeTablePartition {
  partition: string;
  sizeBytes: number;
  rowCount: number;
  fileCount: number;
  createdAt: string;
}

export interface BronzeTableSample {
  columns: ReadonlyArray<string>;
  rows: ReadonlyArray<Readonly<Record<string, unknown>>>;
  totalRows: number;
  sampledAt: string;
}

export interface BronzeIngestJob {
  jobId: string;
  table: string;
  status: EBronzeJobStatus;
  source: 'json' | 'csv' | 'kafka';
  recordsIngested: number;
  bytesIngested: number;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  errorMessage?: string;
}

export interface BronzeJobsStats {
  total: number;
  queued: number;
  running: number;
  success: number;
  failed: number;
  cancelled: number;
  totalRecordsIngested: number;
  totalBytesIngested: number;
}
