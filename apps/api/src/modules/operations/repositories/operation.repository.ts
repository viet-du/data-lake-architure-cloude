import { getMongo } from '@/lib/infra/mongo';
import type { KeysetBoundary } from '@/lib/pagination';
import { OperationEventModel, OperationModel, type OperationDoc, type OperationEventDoc } from './models';
import type {
  Operation,
  OperationEvent,
  OperationEventType,
  OperationKind,
  OperationStatus,
} from '../types';

type PlainOperation = {
  operationId: string;
  kind: OperationKind;
  status: OperationStatus;
  executionTarget: Operation['executionTarget'];
  datasets: Operation['datasets'];
  ownerId: string;
  ownerKind: string;
  idempotencyKey?: string;
  traceId: string;
  retryOfOperationId?: string;
  attempt: number;
  correlation: Operation['correlation'];
  progress: number | null;
  stage?: string;
  metrics: Record<string, unknown>;
  errorMessage?: string;
  errorCode?: string;
  cancellable: boolean;
  retryable: boolean;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
};

function toPlain(doc: OperationDoc | null): PlainOperation | null {
  if (!doc) return null;
  const raw = doc as unknown as Record<string, unknown>;
  return {
    operationId: raw.operationId as string,
    kind: raw.kind as OperationKind,
    status: raw.status as OperationStatus,
    executionTarget: raw.executionTarget as Operation['executionTarget'],
    datasets: (raw.datasets as Operation['datasets']) ?? [],
    ownerId: raw.ownerId as string,
    ownerKind: (raw.ownerKind as string) ?? 'anonymous',
    ...(raw.idempotencyKey ? { idempotencyKey: raw.idempotencyKey as string } : {}),
    traceId: raw.traceId as string,
    ...(raw.retryOfOperationId ? { retryOfOperationId: raw.retryOfOperationId as string } : {}),
    attempt: (raw.attempt as number) ?? 1,
    correlation: (raw.correlation as Operation['correlation']) ?? {},
    progress: (raw.progress as number | null) ?? null,
    ...(raw.stage ? { stage: raw.stage as string } : {}),
    metrics: (raw.metrics as Record<string, unknown>) ?? {},
    ...(raw.errorMessage ? { errorMessage: raw.errorMessage as string } : {}),
    ...(raw.errorCode ? { errorCode: raw.errorCode as string } : {}),
    cancellable: (raw.cancellable as boolean) ?? true,
    retryable: (raw.retryable as boolean) ?? true,
    createdAt: raw.createdAt as string,
    ...(raw.startedAt ? { startedAt: raw.startedAt as string } : {}),
    ...(raw.finishedAt ? { finishedAt: raw.finishedAt as string } : {}),
    ...(raw.durationMs !== undefined && raw.durationMs !== null
      ? { durationMs: raw.durationMs as number }
      : {}),
  };
}

function plainToOperation(plain: PlainOperation): Operation {
  return { ...plain };
}

/**
 * Translate a keyset boundary into a MongoDB query fragment.
 *
 * The rows are ordered by `(createdAt DESC, <id> DESC)`. The fragment
 * selects exactly the rows that sort *after* the boundary:
 *
 * ```text
 * createdAt < at                          → strictly older
 * createdAt = at AND <id> < id            → the rest of the tie group
 * ```
 *
 * The comparison is expressed as `$lt` on both fields, because the rows
 * that sort after the boundary are the ones with a *smaller* value in the
 * descending order.
 *
 * `createdAt` is a plain string in this collection and the ISO-8601 format
 * sorts chronologically as text, so no date casting is needed.
 */
function keysetQuery(
  boundary: KeysetBoundary,
  idField: string,
): Array<Record<string, unknown>> | null {
  switch (boundary.mode) {
    case 'before-at':
      return [{ createdAt: { $lt: boundary.at } }];
    case 'at-or-before':
      return [{ createdAt: { $lte: boundary.at } }];
    case 'compound':
      return [
        { createdAt: { $lt: boundary.at } },
        { createdAt: boundary.at, [idField]: { $lt: boundary.id } },
      ];
    default:
      return null;
  }
}

export interface OperationFilter {
  kind?: OperationKind;
  status?: OperationStatus;
  ownerId?: string;
  datasetId?: string;
  /** The correlation id of the domain job (Bronze/Silver/Gold job id). */
  jobId?: string;
  from?: string;
  to?: string;
  /**
   * The keyset position of the last event that was returned.
   *
   * This is the cursor push-down: the next page asks the database for
   * "the rows that sort immediately after `(at, id)`" instead of fetching a
   * fixed window and filtering in memory.
   *
   * The position is **compound** — `(createdAt, operationId)` — and not a
   * timestamp alone. A timestamp bound is lossy in both directions:
   *
   *  * an *exclusive* bound drops the siblings that share the cursor's
   *    exact millisecond and sort after it, and
   *  * an *inclusive* bound re-fetches the whole tie group, which silently
   *    loses the members that fall outside the fetched window.
   *
   * The compound position removes the ambiguity: exactly one row sorts
   * immediately after the cursor, and the rows before it are never
   * re-read.
   */
  before?: KeysetBoundary;
  limit: number;
  offset: number;
}

export const OperationRepository = {
  async ensureConnection(): Promise<void> {
    await getMongo();
  },

  /**
   * Find the operation created under an idempotency key.
   *
   * The coordinator calls this *before* dispatching so a repeated request
   * returns the original operation instead of running the work twice.
   */
  async findByIdempotencyKey(idempotencyKey: string): Promise<Operation | null> {
    await this.ensureConnection();
    const doc = await OperationModel.findOne({ idempotencyKey }).lean<OperationDoc>().exec();
    const plain = toPlain(doc as unknown as OperationDoc);
    return plain ? plainToOperation(plain) : null;
  },

  async create(input: Omit<Operation, 'createdAt'> & { createdAt?: string }): Promise<Operation> {
    await this.ensureConnection();
    const createdAt = input.createdAt ?? new Date().toISOString();
    const doc = await OperationModel.create({
      operationId: input.operationId,
      kind: input.kind,
      status: input.status,
      executionTarget: input.executionTarget,
      datasets: input.datasets,
      ownerId: input.ownerId,
      ownerKind: input.ownerKind,
      ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
      traceId: input.traceId,
      ...(input.retryOfOperationId ? { retryOfOperationId: input.retryOfOperationId } : {}),
      attempt: input.attempt,
      correlation: input.correlation,
      progress: input.progress,
      ...(input.stage ? { stage: input.stage } : {}),
      metrics: input.metrics,
      ...(input.errorMessage ? { errorMessage: input.errorMessage } : {}),
      ...(input.errorCode ? { errorCode: input.errorCode } : {}),
      cancellable: input.cancellable,
      retryable: input.retryable,
      createdAt,
    });
    const plain = toPlain(doc.toObject() as unknown as OperationDoc);
    return plainToOperation(plain as PlainOperation);
  },

  async findByOperationId(operationId: string): Promise<Operation | null> {
    await this.ensureConnection();
    const doc = await OperationModel.findOne({ operationId }).lean<OperationDoc>().exec();
    const plain = toPlain(doc as unknown as OperationDoc);
    return plain ? plainToOperation(plain) : null;
  },

  /**
   * Apply a patch to an operation.
   *
   * The update is atomic and never rewrites a terminal operation: once a run
   * reached `succeeded`/`failed`/`cancelled`, a late worker callback must
   * not resurrect it as `running`. The `status` filter is applied inside the
   * same query, so the check and the write are one atomic operation.
   */
  async update(
    operationId: string,
    patch: Partial<Operation>,
    options: { onlyIfNotTerminal?: boolean } = {},
  ): Promise<Operation | null> {
    await this.ensureConnection();
    const set: Record<string, unknown> = {};
    if (patch.status !== undefined) set.status = patch.status;
    if (patch.progress !== undefined) set.progress = patch.progress;
    if (patch.stage !== undefined) set.stage = patch.stage;
    if (patch.metrics !== undefined) set.metrics = patch.metrics;
    if (patch.errorMessage !== undefined) set.errorMessage = patch.errorMessage;
    if (patch.errorCode !== undefined) set.errorCode = patch.errorCode;
    if (patch.startedAt !== undefined) set.startedAt = patch.startedAt;
    if (patch.finishedAt !== undefined) set.finishedAt = patch.finishedAt;
    if (patch.durationMs !== undefined) set.durationMs = patch.durationMs;
    if (patch.cancellable !== undefined) set.cancellable = patch.cancellable;
    if (patch.retryable !== undefined) set.retryable = patch.retryable;
    if (patch.correlation !== undefined) set.correlation = patch.correlation;

    const query: Record<string, unknown> = { operationId };
    if (options.onlyIfNotTerminal) {
      query.status = { $nin: ['succeeded', 'failed', 'cancelled', 'partial'] };
    }

    const doc = await OperationModel.findOneAndUpdate(query, { $set: set }, { new: true })
      .lean<OperationDoc>()
      .exec();
    const plain = toPlain(doc as unknown as OperationDoc);
    return plain ? plainToOperation(plain) : null;
  },

  async list(filter: OperationFilter): Promise<{ operations: Operation[]; total: number }> {
    await this.ensureConnection();
    const query: Record<string, unknown> = {};
    if (filter.kind) query.kind = filter.kind;
    if (filter.status) query.status = filter.status;
    if (filter.ownerId) query.ownerId = filter.ownerId;
    if (filter.jobId) query['correlation.jobId'] = filter.jobId;
    if (filter.datasetId) {
      // `datasets` is a mixed array of dataset references; the match targets
      // the canonical dataset id inside it.
      query.datasets = { $elemMatch: { datasetId: filter.datasetId } };
    }
    if (filter.from || filter.to) {
      query.createdAt = {
        ...(filter.from ? { $gte: filter.from } : {}),
        ...(filter.to ? { $lte: filter.to } : {}),
      };
    }
    if (filter.before) {
      // The keyset boundary is pushed down as a lexicographic comparison on
      // `(createdAt, operationId)`. `createdAt` is stored as a string, and
      // the ISO-8601 format sorts chronologically as plain text — so the
      // comparison is exact and needs no date casting.
      const boundary = keysetQuery(filter.before, 'operationId');
      if (boundary) {
        query.$or = [
          ...((query.$or as Array<Record<string, unknown>>) ?? []),
          ...boundary,
        ];
      }
    }

    const [docs, total] = await Promise.all([
      OperationModel.find(query)
        .sort({ createdAt: -1, operationId: -1 })
        .skip(filter.offset)
        .limit(filter.limit)
        .lean<OperationDoc[]>()
        .exec(),
      OperationModel.countDocuments(query).exec(),
    ]);

    const operations = docs
      .map((d) => toPlain(d))
      .filter((p): p is PlainOperation => p !== null)
      .map(plainToOperation);
    return { operations, total };
  },

  // ── Events ────────────────────────────────────────────────────────────────

  async appendEvent(input: {
    eventId: string;
    operationId: string;
    type: OperationEventType;
    message?: string;
    details?: Record<string, unknown>;
    at?: string;
  }): Promise<OperationEvent> {
    await this.ensureConnection();
    const at = input.at ?? new Date().toISOString();
    await OperationEventModel.create({
      eventId: input.eventId,
      operationId: input.operationId,
      type: input.type,
      ...(input.message ? { message: input.message } : {}),
      ...(input.details ? { details: input.details } : {}),
      at,
    });
    return {
      eventId: input.eventId,
      operationId: input.operationId,
      type: input.type,
      ...(input.message ? { message: input.message } : {}),
      ...(input.details ? { details: input.details } : {}),
      at,
    };
  },

  async listEvents(operationId: string, limit = 200): Promise<OperationEvent[]> {
    await this.ensureConnection();
    const docs = await OperationEventModel.find({ operationId })
      .sort({ at: 1 })
      .limit(limit)
      .lean<OperationEventDoc[]>()
      .exec();
    return docs.map((doc) => {
      const raw = doc as unknown as Record<string, unknown>;
      return {
        eventId: raw.eventId as string,
        operationId: raw.operationId as string,
        type: raw.type as OperationEventType,
        ...(raw.message ? { message: raw.message as string } : {}),
        ...(raw.details ? { details: raw.details as Record<string, unknown> } : {}),
        at: raw.at as string,
      };
    });
  },

  /**
   * Operations that were left in a non-terminal state.
   *
   * The reconciler uses this to detect a worker that died mid-run. Such an
   * operation is *not* silently marked failed — the reconciler reports it so
   * an operator can decide whether to retry it.
   */
  async listStaleOperations(olderThanMs: number): Promise<Operation[]> {
    await this.ensureConnection();
    const cutoff = new Date(Date.now() - olderThanMs).toISOString();
    const docs = await OperationModel.find({
      status: { $in: ['queued', 'running'] },
      createdAt: { $lte: cutoff },
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean<OperationDoc[]>()
      .exec();
    return docs
      .map((d) => toPlain(d))
      .filter((p): p is PlainOperation => p !== null)
      .map(plainToOperation);
  },
};
