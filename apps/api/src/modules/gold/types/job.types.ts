import type { GoldAggregateKind, GoldJobStatus } from './job-status.enum';

export interface GoldJob {
  jobId: string;
  table: string;
  database: string;
  kind: GoldAggregateKind;
  status: GoldJobStatus;
  sourceTables: string[];
  rowCount: number;
  bytesProcessed: number;
  /** Delta snapshot version produced by the aggregation, when known. */
  deltaVersion?: number;
  /** Canonical dataset id of the produced dataset. */
  datasetId?: string;
  errorMessage?: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  attemptsMade: number;
}

export interface GoldJobStats {
  total: number;
  queued: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  totalRowsAggregated: number;
}