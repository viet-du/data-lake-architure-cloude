import type { DagRunState, TaskInstanceState } from './airflow.enum';

export interface Dag {
  dagId: string;
  description: string | null;
  scheduleInterval: string | null;
  isActive: boolean;
  isPaused: boolean;
  tags: string[];
  owners: string[];
  fileToken: string;
  lastParsedTime: string | null;
}

export interface DagTask {
  taskId: string;
  operator: string;
  downstreamTaskIds: string[];
  docMd: string | null;
  retries: number;
  retryDelaySeconds: number;
  pool: string;
}

export interface DagDetail extends Dag {
  tasks: DagTask[];
  params: Record<string, unknown>;
  catchup: boolean;
  startDate: string | null;
  endDate: string | null;
  maxActiveRuns: number;
  maxActiveTasks: number;
  defaultArgs: Record<string, unknown>;
}

export interface DagRun {
  runId: string;
  dagId: string;
  executionDate: string;
  state: DagRunState;
  runType: string;
  queuedAt: string | null;
  startDate: string | null;
  endDate: string | null;
  externalTrigger: boolean;
  conf: Record<string, unknown>;
}

export interface TaskInstance {
  taskId: string;
  dagId: string;
  runId: string;
  state: TaskInstanceState;
  tryNumber: number;
  maxTries: number;
  queuedWhen: string | null;
  startDate: string | null;
  endDate: string | null;
  duration: number | null;
  logUrl: string | null;
  operator: string;
  hostname: string | null;
  pool: string;
  poolSlots: number;
}

export interface GanttTask {
  taskId: string;
  startDate: string | null;
  endDate: string | null;
  duration: number | null;
  state: TaskInstanceState;
  operator: string;
}

export interface AirflowHealth {
  webserver: { status: 'healthy' | 'unhealthy'; latestHeartbeat: string | null };
  scheduler: { status: 'healthy' | 'unhealthy'; latestHeartbeat: string | null };
  metadatabase: { status: 'healthy' | 'unhealthy' };
  total: { status: 'healthy' | 'unhealthy' };
}

export interface AirflowStats {
  totalDags: number;
  activeDags: number;
  pausedDags: number;
  runningRuns: number;
  failedRuns: number;
  successRuns: number;
  queuedRuns: number;
  byDate: Array<{ date: string; success: number; failed: number; running: number }>;
  byState: Array<{ state: DagRunState; count: number }>;
}

/**
 * The preflight result.
 *
 * MASTER PLAN §09.1 requires a *typed preflight* before a DAG may be
 * triggered from the UI. The preflight never mutates anything: it answers
 * "would this trigger succeed, and what would it touch?".
 *
 * The three severities map to the three states the UI must be able to show:
 *
 *   * `error`   — the trigger is refused; the button stays disabled;
 *   * `warning` — the trigger is allowed but the operator is informed;
 *   * `info`    — neutral context (schedule mode, retry semantics, …).
 */
export type PreflightSeverity = 'error' | 'warning' | 'info';

export interface PreflightCheck {
  /** A stable machine-readable check id, e.g. `dag.exists`. */
  id: string;
  severity: PreflightSeverity;
  /** A human-readable, already-localisable summary. */
  message: string;
  /** Optional structured detail for the UI to render. */
  detail?: Record<string, unknown>;
}

export interface PreflightResult {
  dagId: string;
  /** `true` when no check reported an `error`. */
  canTrigger: boolean;
  /** The conf keys the DAG accepts, as far as the server can tell. */
  allowedConfKeys: string[];
  /** Conf keys the caller sent that are not on the allowlist. */
  rejectedConfKeys: string[];
  /** The datasets the DAG would read or write, when it can be determined. */
  affectedDatasets: Array<{ layer: string; database: string; table: string }>;
  /** Whether the DAG would run on a schedule as well as manually. */
  scheduleMode: 'scheduled' | 'manual_only';
  checks: PreflightCheck[];
  /** Evaluated against the live Airflow API — a preflight is never cached. */
  evaluatedAt: string;
}
