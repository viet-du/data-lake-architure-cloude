import type { SilverJobStatus, SilverTransformKind } from './job-status.enum';

export interface SilverJob {
  jobId: string;
  table: string;
  database: string;
  kind: SilverTransformKind;
  status: SilverJobStatus;
  sourceTable?: string;
  rowCount: number;
  bytesProcessed: number;
  errorMessage?: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  attemptsMade: number;
}

export interface SilverJobStats {
  total: number;
  queued: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  totalRowsTransformed: number;
}