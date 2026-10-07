import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { CRAWLER_NAMES, CRAWLER_RUN_STATUSES, CRAWLER_ITEM_STATUSES, CRAWLER_SINCE } from '../../types';

const CrawlerRunSchemaDef = new Schema(
  {
    runId: { type: String, required: true, unique: true, index: true },
    crawler: { type: String, enum: CRAWLER_NAMES, required: true, index: true },
    status: { type: String, enum: CRAWLER_RUN_STATUSES, required: true, default: 'queued', index: true },
    requestedBy: { type: String, index: true },
    request: {
      category: { type: String },
      maxPages: { type: Number, required: true, default: 5 },
      language: { type: String },
      since: { type: String, enum: CRAWLER_SINCE },
      dryRun: { type: Boolean, required: true, default: false },
    },
    startedAt: { type: String, required: true, index: true },
    finishedAt: { type: String },
    durationMs: { type: Number },
    items: {
      type: [
        new Schema(
          {
            id: { type: String, required: true },
            status: { type: String, enum: CRAWLER_ITEM_STATUSES, required: true },
            payload: { type: Schema.Types.Mixed, default: {} },
            error: { type: String },
            crawledAt: { type: String, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    stats: {
      total: { type: Number, default: 0 },
      success: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
    },
    errorMessage: { type: String },
    parentJobId: { type: String, index: true },
  },
  { timestamps: true, collection: 'crawler_runs' },
);

CrawlerRunSchemaDef.index({ crawler: 1, startedAt: -1 });
CrawlerRunSchemaDef.index({ status: 1, startedAt: -1 });
CrawlerRunSchemaDef.index({ 'items.status': 1 });

export type CrawlerRunDoc = InferSchemaType<typeof CrawlerRunSchemaDef>;
export const CrawlerRunModel: Model<CrawlerRunDoc> =
  (models.CrawlerRun as Model<CrawlerRunDoc>) ||
  model<CrawlerRunDoc>('CrawlerRun', CrawlerRunSchemaDef);