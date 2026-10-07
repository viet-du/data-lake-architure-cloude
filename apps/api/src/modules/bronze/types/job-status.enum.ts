export const BRONZE_JOB_STATUSES = [
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
] as const;
export type BronzeJobStatus = (typeof BRONZE_JOB_STATUSES)[number];

export const BRONZE_INGEST_KINDS = ['csv', 'json', 'stream'] as const;
export type BronzeIngestKind = (typeof BRONZE_INGEST_KINDS)[number];