import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { CRAWLER_NAMES } from '../../types';

const CrawlerConfigSchemaDef = new Schema(
  {
    name: { type: String, enum: CRAWLER_NAMES, required: true, unique: true, index: true },
    rateLimit: { type: Number, required: true, default: 1.0 },
    maxRetries: { type: Number, required: true, default: 3 },
    timeout: { type: Number, required: true, default: 30 },
    maxWorkers: { type: Number, required: true, default: 8 },
    kafkaTopic: { type: String, default: null },
    userAgent: { type: String, required: true, default: 'LakehouseCrawler/1.0' },
  },
  { timestamps: true, collection: 'crawler_configs' },
);

export type CrawlerConfigDoc = InferSchemaType<typeof CrawlerConfigSchemaDef>;
export const CrawlerConfigModel: Model<CrawlerConfigDoc> =
  (models.CrawlerConfig as Model<CrawlerConfigDoc>) ||
  model<CrawlerConfigDoc>('CrawlerConfig', CrawlerConfigSchemaDef);