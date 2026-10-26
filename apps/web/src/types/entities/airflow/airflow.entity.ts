import type { EHealthStatus } from '@/types/commons';

export type EDagState = 'success' | 'failed' | 'running' | 'queued' | 'skipped' | 'up_for_retry' | 'upstream_failed' | 'planned' | 'none';
export type ETaskState = Exclude<EDagState, 'planned'> | 'scheduled' | 'deferred' | 'removed' | 'restarting' | 'retry';

export interface AirflowDAG {
  dagId: string;
  scheduleInterval?: string;
  isActive: boolean;
  isPaused: boolean;
  tags: ReadonlyArray<string>;
  ownerLinks?: Readonly<Record<string, string>>;
  description?: string;
  lastRunAt?: string;
  lastRunState?: EDagState;
  nextRunAt?: string;
  status: EHealthStatus;
}

export interface AirflowDAGRun {
  runId: string;
  dagId: string;
  state: EDagState;
  executionDate: string;
  startDate?: string;
  endDate?: string;
  durationMs?: number;
  triggeredBy: 'manual' | 'schedule' | 'api' | 'webhook';
}

export interface AirflowTaskInstance {
  taskId: string;
  runId: string;
  state: ETaskState;
  startDate?: string;
  endDate?: string;
  durationMs?: number;
  tryNumber: number;
  operator: string;
  dependencies?: ReadonlyArray<string>;
}

export interface AirflowGanttEntry {
  taskId: string;
  startOffset: number;
  duration: number;
  state: ETaskState;
}

export interface AirflowTriggerResult {
  dagId: string;
  runId: string;
  executionDate: string;
  triggeredAt?: string;
}

export interface AirflowStats {
  totalDAGs: number;
  activeDAGs: number;
  pausedDAGs: number;
  totalRuns: number;
  runningRuns: number;
  failedRuns24h?: number;
  successRate24h?: number;
}

export interface AirflowTaskLogs {
  taskId: string;
  runId: string;
  tryNumber: number;
  logs: string;
}

/**
 * The severity of one preflight check.
 *
 * `error` means the trigger is refused; `warning` means it is allowed but
 * the operator should know; `info` is neutral context.
 */
export type EPreflightSeverity = 'error' | 'warning' | 'info';

export interface AirflowPreflightCheck {
  id: string;
  severity: EPreflightSeverity;
  message: string;
  detail?: Record<string, unknown>;
}

export interface AirflowPreflightResult {
  dagId: string;
  canTrigger: boolean;
  allowedConfKeys: ReadonlyArray<string>;
  rejectedConfKeys: ReadonlyArray<string>;
  affectedDatasets: ReadonlyArray<{ layer: string; database: string; table: string }>;
  scheduleMode: 'scheduled' | 'manual_only';
  checks: ReadonlyArray<AirflowPreflightCheck>;
  evaluatedAt: string;
}

/** The type of one conf field. */
export type EConfFieldType = 'string' | 'number' | 'boolean' | 'enum';

export interface AirflowConfSpec {
  dagId: string;
  keys: ReadonlyArray<string>;
  types: Readonly<Record<string, EConfFieldType>>;
  options: Readonly<Record<string, ReadonlyArray<string>>>;
  descriptions: Readonly<Record<string, string>>;
  affectedDatasets: ReadonlyArray<{ layer: string; database: string; table: string }>;
}
