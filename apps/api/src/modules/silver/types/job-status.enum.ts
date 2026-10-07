export const SILVER_JOB_STATUSES = [
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
] as const;
export type SilverJobStatus = (typeof SILVER_JOB_STATUSES)[number];

export const SILVER_TRANSFORM_KINDS = ['full', 'incremental', 'refresh'] as const;
export type SilverTransformKind = (typeof SILVER_TRANSFORM_KINDS)[number];