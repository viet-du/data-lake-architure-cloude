import type { EHealthStatus } from '@/types/commons';

export type EGoldJobStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled';

export interface GoldTable {
  name: string;
  database: string;
  format: 'delta' | 'parquet';
  sizeBytes: number;
  rowCount: number;
  sourceLayer: 'silver' | 'bronze';
  sourceTables: ReadonlyArray<string>;
  aggregateType?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'group_by';
  refreshSchedule?: string;
  lastRefreshedAt?: string;
  status: EHealthStatus;
  createdAt: string;
  updatedAt: string;
}

export interface GoldTableStats {
  name: string;
  sizeBytes: number;
  rowCount: number;
  fileCount: number;
  refreshDurationMs?: number;
  lastRefreshStatus: EGoldJobStatus;
  consumerLagSeconds?: number;
}

export interface GoldTableHistory {
  version: number;
  timestamp: string;
  operation: 'WRITE' | 'APPEND' | 'REFRESH' | 'OPTIMIZE';
  recordsAffected: number;
  sourceLayer: 'silver' | 'bronze';
  userName?: string;
}

export interface GoldTableSample {
  columns: ReadonlyArray<string>;
  rows: ReadonlyArray<Readonly<Record<string, unknown>>>;
  totalRows: number;
  sampledAt: string;
}

export interface GoldAggregateResult {
  groupBy: ReadonlyArray<string>;
  metrics: ReadonlyArray<{ name: string; value: number }>;
  totalRows: number;
  executionMs: number;
}

export interface GoldAggregateJob {
  jobId: string;
  table: string;
  status: EGoldJobStatus;
  aggregateType: string;
  recordsProcessed: number;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  errorMessage?: string;
}

export interface GoldJobsStats {
  total: number;
  queued: number;
  running: number;
  success: number;
  failed: number;
  totalRecordsProcessed: number;
  avgRefreshDurationMs: number;
}

export interface GoldQueryResult {
  queryName: string;
  columns: ReadonlyArray<string>;
  rows: ReadonlyArray<Readonly<Record<string, unknown>>>;
  totalRows: number;
  executionMs: number;
  ranAt: string;
}
