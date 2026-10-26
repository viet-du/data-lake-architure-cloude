/**
 * Unified operation vocabulary.
 *
 * MASTER PLAN §09.3: every long-running action becomes a canonical
 * `operation` with one lifecycle, one event stream and one correlation
 * surface. The Bronze/Silver/Gold/DQ job records keep their own
 * domain-specific fields, but they are all *producers* of an operation, not
 * a second, competing lifecycle.
 */

/**
 * The operation lifecycle.
 *
 * `accepted` is a transient state between the HTTP response and the moment
 * the operation is persisted; it never appears in a stored document. The
 * persisted lifecycle is:
 *
 *   queued → running → (succeeded | failed | cancelled | partial)
 *
 * `partial` exists because a multi-stage operation can fail half-way with
 * real data committed (MASTER PLAN §03.1 item 10) — reporting that as
 * `failed` would hide the committed data, and reporting it as `succeeded`
 * would be a lie.
 */
export const OPERATION_STATUSES = [
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
  'partial',
] as const;
export type OperationStatus = (typeof OPERATION_STATUSES)[number];

/** The terminal statuses — a run that reached one of them never changes. */
export const TERMINAL_OPERATION_STATUSES: readonly OperationStatus[] = [
  'succeeded',
  'failed',
  'cancelled',
  'partial',
];

export function isTerminalStatus(status: OperationStatus): boolean {
  return TERMINAL_OPERATION_STATUSES.includes(status);
}

/**
 * The operation kinds the control plane can create.
 *
 * The list is an allowlist: the coordinator refuses an unknown kind instead
 * of guessing a dispatcher. It mirrors the whitelisted job operations of
 * the Python runner plus the Airflow control actions, so no code path can
 * turn a request into an arbitrary shell command.
 */
export const OPERATION_KINDS = [
  'bronze.ingest',
  'silver.transform',
  'gold.aggregate',
  'dq.rule_run',
  'crawler.run',
  'airflow.dag_trigger',
] as const;
export type OperationKind = (typeof OPERATION_KINDS)[number];

/**
 * The execution target of an operation.
 *
 * `local_delta_minio` writes to the local MinIO-backed Delta lakehouse;
 * `databricks_uc` is read-only in this deployment (the `remoteReadOnly()`
 * guard rejects every mutation against it).
 */
export const EXECUTION_TARGETS = ['local_delta_minio', 'databricks_uc'] as const;
export type ExecutionTarget = (typeof EXECUTION_TARGETS)[number];

/** The event types emitted along an operation's lifecycle. */
export const OPERATION_EVENT_TYPES = [
  'queued',
  'started',
  'progress',
  'succeeded',
  'failed',
  'cancel_requested',
  'cancelled',
] as const;
export type OperationEventType = (typeof OPERATION_EVENT_TYPES)[number];

/** Correlation with the domain-specific job that produced the operation. */
export interface OperationCorrelation {
  /** The Bronze/Silver/Gold/DQ job id this operation is backed by. */
  jobId?: string;
  /** The BullMQ job id, when the operation was dispatched to a queue. */
  bullJobId?: string;
  /** The Airflow `dagRunId`, when the operation drives a DAG. */
  dagRunId?: string;
  /** The Kafka consumer group and offsets, for stream operations. */
  kafka?: { topic: string; consumerGroup: string; offsets?: Record<string, string> };
}

/** The dataset an operation reads or writes. */
export interface OperationDatasetRef {
  provider: string;
  layer: string;
  database: string;
  table: string;
  /** The Delta snapshot version the operation read, when known. */
  deltaVersion?: number;
  /** The canonical dataset id: `provider/layer.database.table`. */
  datasetId: string;
}

/** A row of the operation event stream. */
export interface OperationEvent {
  eventId: string;
  operationId: string;
  type: OperationEventType;
  /** Human-readable, already sanitised. Never contains a secret. */
  message?: string;
  /** Structured, sanitised detail — row counts, stage names, … */
  details?: Record<string, unknown>;
  /** ISO timestamp. */
  at: string;
}

/** The canonical operation record. */
export interface Operation {
  operationId: string;
  kind: OperationKind;
  status: OperationStatus;
  executionTarget: ExecutionTarget;
  /** The datasets this operation touches. */
  datasets: OperationDatasetRef[];
  /** The principal that requested the operation. */
  ownerId: string;
  ownerKind: string;
  /** The idempotency key that created this operation. */
  idempotencyKey?: string;
  /** A stable correlation id shared by the operation and its events. */
  traceId: string;
  /** The operation this one retries, when it is a retry attempt. */
  retryOfOperationId?: string;
  /** The attempt number — 1 for the first try. */
  attempt: number;
  correlation: OperationCorrelation;
  /** Progress in percent, 0–100. `null` when the operation has no stages. */
  progress: number | null;
  /** The current stage name, when the operation is staged. */
  stage?: string;
  /** Output metrics: rows, bytes, delta versions. */
  metrics: Record<string, unknown>;
  /** A sanitised error message. Never a raw upstream stack trace. */
  errorMessage?: string;
  /** The error code, e.g. `BRONZE_INGEST_FAILED`. */
  errorCode?: string;
  /** Whether the operation may be cancelled. */
  cancellable: boolean;
  /** Whether the operation may be retried. */
  retryable: boolean;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
}

/** A paged list of operations. */
export interface OperationListResult {
  operations: Operation[];
  total: number;
  limit: number;
  offset: number;
}
