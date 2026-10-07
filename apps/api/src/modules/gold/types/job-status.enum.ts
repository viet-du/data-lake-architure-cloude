export const GOLD_JOB_STATUSES = [
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
] as const;
export type GoldJobStatus = (typeof GOLD_JOB_STATUSES)[number];

export const GOLD_AGGREGATE_KINDS = ['full', 'incremental', 'refresh'] as const;
export type GoldAggregateKind = (typeof GOLD_AGGREGATE_KINDS)[number];