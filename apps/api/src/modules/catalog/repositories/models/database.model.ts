import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { LAYERS } from '../../types';

const DatabaseSchemaDef = new Schema(
  {
    database: { type: String, required: true, unique: true, index: true },
    description: { type: String },
    layers: {
      type: [String],
      enum: LAYERS,
      default: ['bronze', 'silver', 'gold'],
    },
    tableCount: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'catalog_databases' },
);

export type DatabaseDoc = InferSchemaType<typeof DatabaseSchemaDef>;
export const DatabaseModel: Model<DatabaseDoc> =
  (models.CatalogDatabase as Model<DatabaseDoc>) ||
  model<DatabaseDoc>('CatalogDatabase', DatabaseSchemaDef);