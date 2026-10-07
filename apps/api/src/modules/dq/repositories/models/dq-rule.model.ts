import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { DQ_RULE_TYPE, DQ_LAYER, DQ_SEVERITY } from '../../types';

const DqRuleSchemaDef = new Schema(
  {
    ruleId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, index: true },
    description: { type: String, default: null },
    type: { type: String, enum: DQ_RULE_TYPE, required: true, index: true },
    layer: { type: String, enum: DQ_LAYER, required: true, index: true },
    table: { type: String, required: true, index: true },
    column: { type: String, default: null },
    params: { type: Schema.Types.Mixed, required: true, default: {} },
    severity: { type: String, enum: DQ_SEVERITY, required: true, default: 'medium', index: true },
    enabled: { type: Boolean, required: true, default: true, index: true },
    tags: { type: [String], required: true, default: [] },
  },
  { timestamps: true, collection: 'dq_rules' },
);

DqRuleSchemaDef.index({ name: 1, layer: 1 });
DqRuleSchemaDef.index({ tags: 1 });

export const DqRuleModel: Model<InferSchemaType<typeof DqRuleSchemaDef>> =
  (models.DqRule as Model<InferSchemaType<typeof DqRuleSchemaDef>>) ||
  model('DqRule', DqRuleSchemaDef);

export type DqRuleDoc = ReturnType<typeof DqRuleModel.hydrate>;