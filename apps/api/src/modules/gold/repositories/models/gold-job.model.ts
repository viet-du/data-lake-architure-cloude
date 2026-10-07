import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { GOLD_JOB_STATUSES, GOLD_AGGREGATE_KINDS } from '../../types';

const GoldJobSchemaDef = new Schema(
  {
    jobId: { type: String, required: true, unique: true, index: true },
    database: { type: String, required: true, index: true },
    table: { type: String, required: true, index: true },
    kind: { type: String, enum: GOLD_AGGREGATE_KINDS, required: true, index: true },
    status: { type: String, enum: GOLD_JOB_STATUSES, required: true, default: 'queued', index: true },
    sourceTables: { type: [String], default: [] },
    rowCount: { type: Number, default: 0 },
    bytesProcessed: { type: Number, default: 0 },
    errorMessage: { type: String },
    bullJobId: { type: String, index: true },
    startedAt: { type: String, required: true },
    finishedAt: { type: String },
    durationMs: { type: Number },
    attemptsMade: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'gold_jobs' },
);

GoldJobSchemaDef.index({ database: 1, table: 1, startedAt: -1 });
GoldJobSchemaDef.index({ status: 1, startedAt: -1 });

export type GoldJobDoc = InferSchemaType<typeof GoldJobSchemaDef>;
export const GoldJobModel: Model<GoldJobDoc> =
  (models.GoldJob as Model<GoldJobDoc>) || model<GoldJobDoc>('GoldJob', GoldJobSchemaDef);