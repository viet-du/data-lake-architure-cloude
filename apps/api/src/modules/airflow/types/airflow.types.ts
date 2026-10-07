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