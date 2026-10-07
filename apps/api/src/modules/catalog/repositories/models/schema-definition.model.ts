import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

const FieldSchema = new Schema(
  {
    name: { type: String, required: true },
    type: { type: String, required: true },
    nullable: { type: Boolean, default: true },
    description: { type: String },
    constraints: { type: Schema.Types.Mixed },
  },
  { _id: false },
);

const SchemaDefinitionSchemaDef = new Schema(
  {
    name: { type: String, required: true, unique: true, index: true },
    version: { type: String, required: true, default: '1.0.0' },
    description: { type: String },
    fields: { type: [FieldSchema], default: [] },
    primaryKey: { type: [String], default: [] },
  },
  { timestamps: true, collection: 'catalog_schemas' },
);

export type SchemaDefinitionDoc = InferSchemaType<typeof SchemaDefinitionSchemaDef>;
export const SchemaDefinitionModel: Model<SchemaDefinitionDoc> =
  (models.CatalogSchemaDefinition as Model<SchemaDefinitionDoc>) ||
  model<SchemaDefinitionDoc>('CatalogSchemaDefinition', SchemaDefinitionSchemaDef);