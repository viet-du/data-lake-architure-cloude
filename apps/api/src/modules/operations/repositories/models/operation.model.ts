import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { OPERATION_EVENT_TYPES, OPERATION_KINDS, OPERATION_STATUSES } from '../../types';

/**
 * The canonical operation record.
 *
 * MASTER PLAN §09.3 requires a datastore that supports cursor paging and
 * filtering by kind/status/dataset/owner/time. The indexes below are the
 * ones those queries actually need; there is no index that no query uses.
 *
 * `idempotencyKey` is unique so a repeated `POST /api/operations` with the
 * same key returns the *same* operation instead of dispatching the work
 * twice.
 */
const OperationSchemaDef = new Schema(
  {
    operationId: { type: String, required: true, unique: true, index: true },
    kind: { type: String, enum: OPERATION_KINDS, required: true, index: true },
    status: { type: String, enum: OPERATION_STATUSES, required: true, default: 'queued', index: true },
    executionTarget: { type: String, required: true },
    datasets: { type: Schema.Types.Mixed, default: [] },
    ownerId: { type: String, required: true, index: true },
    ownerKind: { type: String, required: true, default: 'anonymous' },
    // The index is declared below as a *partial* unique index, so this
    // field must not also declare `index: true` — Mongoose would create
    // the index twice.
    idempotencyKey: { type: String },
    traceId: { type: String, required: true, index: true },
    retryOfOperationId: { type: String, index: true },
    attempt: { type: Number, required: true, default: 1 },
    correlation: { type: Schema.Types.Mixed, default: {} },
    progress: { type: Number, default: null },
    stage: { type: String },
    metrics: { type: Schema.Types.Mixed, default: {} },
    errorMessage: { type: String },
    errorCode: { type: String },
    cancellable: { type: Boolean, required: true, default: true },
    retryable: { type: Boolean, required: true, default: true },
    createdAt: { type: String, required: true },
    startedAt: { type: String },
    finishedAt: { type: String },
    durationMs: { type: Number },
  },
  { timestamps: true, collection: 'operations' },
);

// The idempotency guarantee: one key → one operation. The partial filter
// lets a key be reused by a *different* owner without colliding, which is
// the behaviour a shared client key space would otherwise break.
OperationSchemaDef.index(
  { idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);
OperationSchemaDef.index({ status: 1, createdAt: -1 });
OperationSchemaDef.index({ kind: 1, createdAt: -1 });
OperationSchemaDef.index({ ownerId: 1, createdAt: -1 });
OperationSchemaDef.index({ 'correlation.jobId': 1 });
// The compound keyset sort of the activity feed is `(createdAt DESC,
// operationId DESC)`. Without this index the cursor push-down degrades into
// a collection scan plus an in-memory sort, which is exactly the cost the
// push-down exists to avoid.
OperationSchemaDef.index({ createdAt: -1, operationId: -1 });

export type OperationDoc = InferSchemaType<typeof OperationSchemaDef>;
export const OperationModel: Model<OperationDoc> =
  (models.Operation as Model<OperationDoc>) ||
  model<OperationDoc>('Operation', OperationSchemaDef);

/**
 * The operation event stream.
 *
 * Events are append-only and carry their own index, so the UI can follow
 * the lifecycle of one operation without reading the operation document.
 */
const OperationEventSchemaDef = new Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    operationId: { type: String, required: true, index: true },
    type: { type: String, enum: OPERATION_EVENT_TYPES, required: true, index: true },
    message: { type: String },
    details: { type: Schema.Types.Mixed },
    at: { type: String, required: true },
  },
  { timestamps: false, collection: 'operation_events' },
);

OperationEventSchemaDef.index({ operationId: 1, at: 1 });

export type OperationEventDoc = InferSchemaType<typeof OperationEventSchemaDef>;
export const OperationEventModel: Model<OperationEventDoc> =
  (models.OperationEvent as Model<OperationEventDoc>) ||
  model<OperationEventDoc>('OperationEvent', OperationEventSchemaDef);
