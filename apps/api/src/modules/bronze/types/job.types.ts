import type { BronzeIngestKind, BronzeJobStatus } from './job-status.enum';

export interface BronzeJob {
  jobId: string;
  table: string;
  database: string;
  kind: BronzeIngestKind;
  status: BronzeJobStatus;
  source?: string;
  topic?: string;
  rowCount: number;
  bytesProcessed: number;
  errorMessage?: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  attemptsMade: number;
}

export interface BronzeJobStats {
  total: number;
  queued: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  totalRowsIngested: number;
  totalBytesProcessed: number;
}