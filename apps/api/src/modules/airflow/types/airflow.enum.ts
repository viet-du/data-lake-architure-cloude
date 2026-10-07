export const DAG_RUN_STATE = [
  'success',
  'failed',
  'running',
  'queued',
  'skipped',
  'up_for_retry',
  'upstream_failed',
  'planned',
  'none',
] as const;
export type DagRunState = (typeof DAG_RUN_STATE)[number];

export const TASK_INSTANCE_STATE = [
  'success',
  'failed',
  'running',
  'queued',
  'skipped',
  'up_for_retry',
  'upstream_failed',
  'scheduled',
  'deferred',
  'removed',
  'restarting',
  'none',
] as const;
export type TaskInstanceState = (typeof TASK_INSTANCE_STATE)[number];