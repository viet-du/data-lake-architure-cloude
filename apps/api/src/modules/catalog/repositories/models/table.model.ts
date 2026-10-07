import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { LAYERS } from '../../types';

const ColumnSchema = new Schema(
  {
    name: { type: String, required: true },
    type: { type: String, required: true },
    nullable: { type: Boolean, default: true },
    description: { type: String },
  },
  { _id: false },
);

const PartitionSchema = new Schema(
  {
    column: { type: String, required: true },
    value: { type: String, required: true },
  },
  { _id: false },
);

const TableSchemaDef = new Schema(
  {
    tableId: { type: String, required: true, unique: true, index: true },
    layer: { type: String, enum: LAYERS, required: true, index: true },
    database: { type: String, required: true, index: true },
    name: { type: String, required: true, index: true },
    fullName: { type: String, required: true },
    description: { type: String },
    owner: { type: String, index: true },
    tags: { type: [String], default: [], index: true },
    partitions: { type: [PartitionSchema], default: [] },
    columns: { type: [ColumnSchema], default: [] },
    columnCount: { type: Number, default: 0 },
    rowCount: { type: Number, default: 0 },
    sizeBytes: { type: Number, default: 0 },
    lastModified: { type: String },
    s3Path: { type: String, required: true },
    deltaHistoryVersion: { type: Number, default: 0 },
    lineage: {
      upstreamTableIds: { type: [String], default: [] },
      downstreamTableIds: { type: [String], default: [] },
    },
  },
  { timestamps: true, collection: 'catalog_tables' },
);

TableSchemaDef.index({ layer: 1, database: 1, name: 1 });
TableSchemaDef.index({ tags: 1, layer: 1 });
TableSchemaDef.index({ description: 'text', name: 'text', owner: 'text' });

export type TableDoc = InferSchemaType<typeof TableSchemaDef>;
export const TableModel: Model<TableDoc> =
  (models.CatalogTable as Model<TableDoc>) || model<TableDoc>('CatalogTable', TableSchemaDef);