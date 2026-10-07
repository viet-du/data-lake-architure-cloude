import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { BRONZE_JOB_STATUSES, BRONZE_INGEST_KINDS } from '../../types';

const BronzeJobSchemaDef = new Schema(
  {
    jobId: { type: String, required: true, unique: true, index: true },
    database: { type: String, required: true, index: true },
    table: { type: String, required: true, index: true },
    kind: { type: String, enum: BRONZE_INGEST_KINDS, required: true, index: true },
    status: { type: String, enum: BRONZE_JOB_STATUSES, required: true, default: 'queued', index: true },
    source: { type: String },
    topic: { type: String },
    rowCount: { type: Number, default: 0 },
    bytesProcessed: { type: Number, default: 0 },
    errorMessage: { type: String },
    bullJobId: { type: String, index: true },
    startedAt: { type: String, required: true },
    finishedAt: { type: String },
    durationMs: { type: Number },
    attemptsMade: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'bronze_jobs' },
);

BronzeJobSchemaDef.index({ database: 1, table: 1, startedAt: -1 });
BronzeJobSchemaDef.index({ status: 1, startedAt: -1 });

export type BronzeJobDoc = InferSchemaType<typeof BronzeJobSchemaDef>;
export const BronzeJobModel: Model<BronzeJobDoc> =
  (models.BronzeJob as Model<BronzeJobDoc>) || model<BronzeJobDoc>('BronzeJob', BronzeJobSchemaDef);