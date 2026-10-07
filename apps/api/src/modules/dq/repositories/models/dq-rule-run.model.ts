import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { DQ_RULE_TYPE, DQ_LAYER, DQ_SEVERITY, DQ_RUN_STATUS, DQ_RUN_TRIGGER } from '../../types';

const DqRuleRunSchemaDef = new Schema(
  {
    runId: { type: String, required: true, unique: true, index: true },
    ruleId: { type: String, default: null, index: true },
    ruleName: { type: String, required: true },
    type: { type: String, enum: DQ_RULE_TYPE, required: true },
    layer: { type: String, enum: DQ_LAYER, required: true, index: true },
    table: { type: String, required: true, index: true },
    status: { type: String, enum: DQ_RUN_STATUS, required: true, index: true },
    trigger: { type: String, enum: DQ_RUN_TRIGGER, required: true, default: 'manual' },
    severity: { type: String, enum: DQ_SEVERITY, required: true, default: 'medium' },
    totalRows: { type: Number, required: true, default: 0 },
    failedRows: { type: Number, required: true, default: 0 },
    passRate: { type: Number, required: true, default: 0 },
    errorMessage: { type: String, default: null },
    durationMs: { type: Number, required: true, default: 0 },
    startedAt: { type: String, required: true, index: true },
    finishedAt: { type: String, required: true },
    suiteRunId: { type: String, default: null, index: true },
    sampleFailures: { type: [Schema.Types.Mixed], required: true, default: [] },
  },
  { collection: 'dq_runs' },
);

DqRuleRunSchemaDef.index({ ruleId: 1, startedAt: -1 });
DqRuleRunSchemaDef.index({ suiteRunId: 1, startedAt: 1 });

export const DqRuleRunModel: Model<InferSchemaType<typeof DqRuleRunSchemaDef>> =
  (models.DqRuleRun as Model<InferSchemaType<typeof DqRuleRunSchemaDef>>) ||
  model('DqRuleRun', DqRuleRunSchemaDef);

export type DqRuleRunDoc = ReturnType<typeof DqRuleRunModel.hydrate>;