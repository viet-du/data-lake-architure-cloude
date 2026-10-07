import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { SILVER_JOB_STATUSES, SILVER_TRANSFORM_KINDS } from '../../types';

const SilverJobSchemaDef = new Schema(
  {
    jobId: { type: String, required: true, unique: true, index: true },
    database: { type: String, required: true, index: true },
    table: { type: String, required: true, index: true },
    kind: { type: String, enum: SILVER_TRANSFORM_KINDS, required: true, index: true },
    status: { type: String, enum: SILVER_JOB_STATUSES, required: true, default: 'queued', index: true },
    sourceTable: { type: String },
    rowCount: { type: Number, default: 0 },
    bytesProcessed: { type: Number, default: 0 },
    errorMessage: { type: String },
    bullJobId: { type: String, index: true },
    startedAt: { type: String, required: true },
    finishedAt: { type: String },
    durationMs: { type: Number },
    attemptsMade: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'silver_jobs' },
);

SilverJobSchemaDef.index({ database: 1, table: 1, startedAt: -1 });
SilverJobSchemaDef.index({ status: 1, startedAt: -1 });

export type SilverJobDoc = InferSchemaType<typeof SilverJobSchemaDef>;
export const SilverJobModel: Model<SilverJobDoc> =
  (models.SilverJob as Model<SilverJobDoc>) || model<SilverJobDoc>('SilverJob', SilverJobSchemaDef);