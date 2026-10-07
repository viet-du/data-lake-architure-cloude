import type { EHealthStatus } from '@/types/commons';

export type EDagState = 'success' | 'failed' | 'running' | 'queued';

export interface AirflowDAG {
  dagId: string;
  scheduleInterval?: string;
  isActive: boolean;
  isPaused: boolean;
  tags: ReadonlyArray<string>;
  ownerLinks: Readonly<Record<string, string>>;
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
  state: 'success' | 'failed' | 'running' | 'queued' | 'skipped' | 'upstream_failed' | 'retry';
  startDate?: string;
  endDate?: string;
  durationMs?: number;
  tryNumber: number;
  operator: string;
  dependencies: ReadonlyArray<string>;
}

export interface AirflowGanttEntry {
  taskId: string;
  startOffset: number;
  duration: number;
  state: 'success' | 'failed' | 'running' | 'queued' | 'skipped';
}

export interface AirflowTriggerResult {
  dagId: string;
  runId: string;
  executionDate: string;
  triggeredAt: string;
}

export interface AirflowStats {
  totalDAGs: number;
  activeDAGs: number;
  pausedDAGs: number;
  totalRuns: number;
  runningRuns: number;
  failedRuns24h: number;
  successRate24h: number;
}

export interface AirflowTaskLogs {
  taskId: string;
  runId: string;
  tryNumber: number;
  logs: string;
}
