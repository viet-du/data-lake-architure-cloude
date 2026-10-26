import { randomUUID } from 'node:crypto';
import { AppError } from '@/errors';
import { NotFoundError } from '@/errors';
import { logger } from '@/lib/logger';
import { OperationRepository } from '../repositories/operation.repository';
import {
  cancelOperationJob,
  dispatchOperation,
  resolveOperationDatasets,
} from './operation-dispatcher';
import {
  isTerminalStatus,
  type Operation,
  type OperationEvent,
  type OperationEventType,
  type OperationListResult,
} from '../types';
import type {
  TCreateOperationBody,
  TOperationListQuery,
  TRetryOperationBody,
} from '../schemas';

/**
 * The unified operation coordinator.
 *
 * MASTER PLAN §03.1 defines the lifecycle in nine steps; this service
 * implements the parts that belong to the API process:
 *
 *   1. the request is typed and validated (the schema does that);
 *   2. the request is authorized (the auth middleware does that);
 *   3. an idempotency key is read from the header;
 *   4. a canonical `operationId` is generated;
 *   5. the operation and its first event are written **atomically enough**
 *      for the dispatcher: the operation row is written first, so a crash
 *      between the write and the dispatch leaves a visible `queued`
 *      operation that the reconciler can pick up — never a silent success;
 *   6. the dispatch happens exactly once, guarded by the idempotency key;
 *   7. the operation correlates to the domain job;
 *   8. the terminal state is reconciled from the domain job.
 *
 * The coordinator never invents a success. A dispatch that throws leaves the
 * operation in `failed` with the real error, and the `queued`→`running`
 * transition is applied by the reconciler when it observes the domain job.
 */

/** The principal that requested an operation. */
export interface OperationOwner {
  principalId: string;
  principalKind: string;
}

function newOperationId(): string {
  return `op_${Date.now().toString(36)}_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

function newEventId(): string {
  return `evt_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

/**
 * The principals that may act on *any* operation.
 *
 * A service principal acts on behalf of the platform, not on behalf of one
 * user, so it is not bound to the operation's owner. The synthetic
 * principal is the one used when authentication is disabled — it must not
 * be locked out by an ownership check it can never satisfy.
 */
const UNBOUND_OWNER_KINDS: ReadonlySet<string> = new Set(['service', 'anonymous']);

export const OperationService = {
  /**
   * Assert that the caller may act on this operation.
   *
   * MASTER PLAN §05.4 requires a destructive action to display "exact
   * resource + effects + ownership" and to be enforced by the *backend*.
   * The role check in the auth middleware answers "may this principal
   * cancel a job at all"; this check answers the second half — "may this
   * principal cancel *this* job".
   *
   * A user principal is bound to the operation it created: a user may not
   * cancel somebody else's run. Service and anonymous principals are not
   * bound, because they act for the platform rather than for one user.
   */
  assertOwner(operation: Operation, owner: OperationOwner): void {
    if (UNBOUND_OWNER_KINDS.has(owner.principalKind)) return;
    if (operation.ownerId === owner.principalId) return;

    throw new AppError(
      403,
      'OPERATION_NOT_OWNED',
      `Operation ${operation.operationId} was started by another principal and cannot be modified.`,
    );
  },

  /**
   * Create and dispatch an operation.
   *
   * When an idempotency key is supplied and an operation already exists for
   * it, the *existing* operation is returned unchanged — the work is not
   * dispatched a second time.
   */
  async create(
    body: TCreateOperationBody,
    owner: OperationOwner,
    idempotencyKey?: string,
  ): Promise<Operation> {
    if (idempotencyKey) {
      const existing = await OperationRepository.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        logger.info(
          { operationId: existing.operationId, idempotencyKey },
          'Operation request replayed via idempotency key',
        );
        return existing;
      }
    }

    const operationId = newOperationId();
    const traceId = body.clientRequestId ?? `trace_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

    // The datasets are resolved through the shared resolver *before* the
    // operation is persisted, so the stored identity is canonical even if
    // the dispatch later fails.
    const datasets = resolveOperationDatasets(body.datasets);

    const operation = await OperationRepository.create({
      operationId,
      kind: body.kind,
      status: 'queued',
      executionTarget: body.executionTarget,
      datasets,
      ownerId: owner.principalId,
      ownerKind: owner.principalKind,
      ...(idempotencyKey ? { idempotencyKey } : {}),
      traceId,
      attempt: 1,
      correlation: {},
      progress: 0,
      metrics: {},
      cancellable: true,
      retryable: true,
      createdAt: new Date().toISOString(),
    });

    await this.appendEvent(operation, 'queued', 'Operation accepted', {
      kind: body.kind,
      datasets: datasets.map((d) => d.datasetId),
    });

    try {
      const dispatched = await dispatchOperation(body.kind, body.datasets, body.params);
      const updated = await OperationRepository.update(operationId, {
        correlation: { jobId: dispatched.jobId },
        metrics: dispatched.metrics ?? {},
        status: 'running',
        progress: 10,
        startedAt: new Date().toISOString(),
      });
      await this.appendEvent(
        updated ?? operation,
        'started',
        'Operation dispatched',
        { jobId: dispatched.jobId, ...(dispatched.metrics ?? {}) },
      );
      return updated ?? operation;
    } catch (error) {
      const code = error instanceof AppError ? error.code : 'OPERATION_DISPATCH_FAILED';
      const message = error instanceof Error ? error.message : String(error);
      const failed = await OperationRepository.update(operationId, {
        status: 'failed',
        errorCode: code,
        errorMessage: message,
        progress: 100,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - new Date(operation.createdAt).getTime(),
      });
      await this.appendEvent(failed ?? operation, 'failed', message, { code });
      logger.error({ operationId, code, error: message }, 'Operation dispatch failed');
      // The operation exists and is visible in the run history — the caller
      // gets the failure *and* a durable record of it.
      throw error instanceof AppError
        ? error
        : new AppError(500, 'OPERATION_DISPATCH_FAILED', message);
    }
  },

  async getOrFail(operationId: string): Promise<Operation> {
    const operation = await OperationRepository.findByOperationId(operationId);
    if (!operation) throw new NotFoundError('Operation', operationId);
    return operation;
  },

  async list(query: TOperationListQuery): Promise<OperationListResult> {
    const { operations, total } = await OperationRepository.list({
      limit: query.limit,
      offset: query.offset,
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.ownerId ? { ownerId: query.ownerId } : {}),
      ...(query.datasetId ? { datasetId: query.datasetId } : {}),
      ...(query.jobId ? { jobId: query.jobId } : {}),
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {}),
    });
    return { operations, total, limit: query.limit, offset: query.offset };
  },

  async events(operationId: string, limit: number): Promise<OperationEvent[]> {
    // The operation must exist — otherwise the endpoint would answer 200
    // with an empty list for an unknown id, which reads as "no events yet"
    // instead of "no such operation".
    await this.getOrFail(operationId);
    return OperationRepository.listEvents(operationId, limit);
  },

  /**
   * Request cancellation.
   *
   * The operation is only moved to `cancelled` when the backend actually
   * stopped the work. When the backend cannot cancel the kind, the request
   * is recorded as `cancel_requested` and the operation stays non-terminal:
   * the honest state is "we asked", not "it stopped".
   */
  async cancel(operationId: string, owner: OperationOwner): Promise<Operation> {
    const operation = await this.getOrFail(operationId);

    this.assertOwner(operation, owner);

    if (isTerminalStatus(operation.status)) {
      throw new AppError(
        409,
        'OPERATION_ALREADY_TERMINAL',
        `Operation ${operationId} is already ${operation.status} and cannot be cancelled.`,
      );
    }

    if (!operation.cancellable) {
      throw new AppError(
        409,
        'OPERATION_NOT_CANCELLABLE',
        `Operation ${operationId} does not support cancellation.`,
      );
    }

    const jobId = operation.correlation.jobId;
    if (!jobId) {
      // The operation was never dispatched (or the dispatch failed before
      // producing a job id). There is nothing to stop, so the operation is
      // cancelled directly.
      const cancelled = await OperationRepository.update(operationId, {
        status: 'cancelled',
        progress: 100,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - new Date(operation.createdAt).getTime(),
      });
      await this.appendEvent(cancelled ?? operation, 'cancelled', 'Operation cancelled before dispatch');
      return cancelled ?? operation;
    }

    const stopped = await cancelOperationJob(operation.kind, jobId);
    if (!stopped) {
      const requested = await OperationRepository.update(operationId, {
        status: 'running',
        metrics: { ...operation.metrics, cancelRequested: true },
      });
      await this.appendEvent(
        requested ?? operation,
        'cancel_requested',
        'Cancellation was requested but the backend did not confirm it',
        { jobId },
      );
      return requested ?? operation;
    }

    const cancelled = await OperationRepository.update(operationId, {
      status: 'cancelled',
      progress: 100,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - new Date(operation.createdAt).getTime(),
    });
    await this.appendEvent(cancelled ?? operation, 'cancelled', 'Operation cancelled', { jobId });
    return cancelled ?? operation;
  },

  /**
   * Retry a failed operation.
   *
   * The retry is a *new* operation that links back to the original one, so
   * the run history keeps both attempts and the provenance is preserved.
   * A successful operation is not retryable unless `force` is set.
   */
  async retry(
    operationId: string,
    body: TRetryOperationBody,
    owner: OperationOwner,
    idempotencyKey?: string,
  ): Promise<Operation> {
    const original = await this.getOrFail(operationId);

    this.assertOwner(original, owner);

    if (original.status === 'succeeded' && !body.force) {
      throw new AppError(
        409,
        'OPERATION_NOT_RETRYABLE',
        `Operation ${operationId} succeeded; a retry is only allowed for a failed operation.`,
      );
    }
    if (!original.retryable) {
      throw new AppError(
        409,
        'OPERATION_NOT_RETRYABLE',
        `Operation ${operationId} cannot be retried.`,
      );
    }

    // The retry gets its own idempotency key namespace so it never collides
    // with the original operation's key.
    const retryKey = idempotencyKey
      ? `${idempotencyKey}:retry:${original.operationId}:${original.attempt + 1}`
      : undefined;

    const retryOperation = await this.create(
      {
        kind: original.kind,
        executionTarget: original.executionTarget,
        datasets: original.datasets.map((d) => ({
          layer: d.layer as 'bronze' | 'silver' | 'gold',
          database: d.database,
          table: d.table,
        })),
        params: (original.metrics.params as Record<string, unknown>) ?? {},
        clientRequestId: original.traceId,
      },
      owner,
      retryKey,
    );

    const linked = await OperationRepository.update(retryOperation.operationId, {
      retryOfOperationId: original.operationId,
      attempt: original.attempt + 1,
    });
    await this.appendEvent(linked ?? retryOperation, 'started', 'Retry started', {
      retryOfOperationId: original.operationId,
      attempt: original.attempt + 1,
    });
    return linked ?? retryOperation;
  },

  /**
   * Append an event to an operation's stream.
   *
   * The event is the UI's progress signal, so it is written for every
   * lifecycle transition — including the ones the reconciler performs.
   */
  async appendEvent(
    operation: Operation,
    type: OperationEventType,
    message?: string,
    details?: Record<string, unknown>,
  ): Promise<OperationEvent> {
    return OperationRepository.appendEvent({
      eventId: newEventId(),
      operationId: operation.operationId,
      type,
      ...(message ? { message } : {}),
      ...(details ? { details } : {}),
    });
  },
};
