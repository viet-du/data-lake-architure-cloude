import { z } from 'zod';
import { apiResponseSchema, healthStatusSchema } from '../commons.schema';

export const dqRuleTypeSchema = z.enum(['not_null', 'unique', 'range', 'regex', 'custom']);
export const dqSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export const dqStatusSchema = z.enum(['pass', 'fail', 'warning']);
export const dqRunStatusSchema = z.enum(['queued', 'running', 'success', 'failed']);

export const dqRuleSchema = z.object({
  ruleId: z.string(),
  tableName: z.string(),
  ruleName: z.string(),
  ruleType: dqRuleTypeSchema,
  severity: dqSeveritySchema,
  status: dqStatusSchema,
  columnName: z.string().optional(),
  expression: z.string().min(1),
  enabled: z.boolean(),
  lastRunAt: z.string().optional(),
  lastRunResult: dqStatusSchema.optional(),
  failedRows: z.number().int().nonnegative().optional(),
  totalRows: z.number().int().nonnegative().optional(),
  description: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const dqRuleCreatePayloadSchema = z.object({
  tableName: z.string().min(1),
  ruleName: z.string().min(1),
  ruleType: dqRuleTypeSchema,
  severity: dqSeveritySchema,
  columnName: z.string().optional(),
  expression: z.string().min(1),
  description: z.string().optional(),
});

export const dqRuleUpdatePayloadSchema = z.object({
  ruleName: z.string().optional(),
  severity: dqSeveritySchema.optional(),
  expression: z.string().optional(),
  enabled: z.boolean().optional(),
  description: z.string().optional(),
});

export const dqRunSchema = z.object({
  runId: z.string(),
  ruleId: z.string().optional(),
  status: dqRunStatusSchema,
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  passedRules: z.number().int().nonnegative(),
  failedRules: z.number().int().nonnegative(),
  warningRules: z.number().int().nonnegative(),
  totalCheckedRows: z.number().int().nonnegative(),
  errorMessage: z.string().optional(),
});

export const dqPresetSchema = z.object({
  presetId: z.string(),
  name: z.string(),
  description: z.string(),
  rules: z.array(
    dqRuleSchema.omit({ ruleId: true, tableName: true, createdAt: true, updatedAt: true }),
  ),
});

export const dqSummarySchema = z.object({
  totalRules: z.number().int().nonnegative(),
  passing: z.number().int().nonnegative(),
  failing: z.number().int().nonnegative(),
  warning: z.number().int().nonnegative(),
  lastRunAt: z.string().optional(),
  overallStatus: healthStatusSchema,
  bySeverity: z.object({
    low: z.number().int().nonnegative(),
    medium: z.number().int().nonnegative(),
    high: z.number().int().nonnegative(),
    critical: z.number().int().nonnegative(),
  }),
});

export const listRulesParamsSchema = z.object({
  tableName: z.string().optional(),
  severity: dqSeveritySchema.optional(),
  enabled: z.boolean().optional(),
});

export const listRunsParamsSchema = z.object({
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().nonnegative().optional(),
  ruleId: z.string().optional(),
  status: dqRunStatusSchema.optional(),
});

export const runSuitePayloadSchema = z.object({
  ruleIds: z.array(z.string()).optional(),
  tables: z.array(z.string()).optional(),
  parallel: z.number().int().min(1).max(32).optional(),
});

export const dqRulesResponseSchema = apiResponseSchema(z.array(dqRuleSchema));
export const dqRuleResponseSchema = apiResponseSchema(dqRuleSchema);
export const dqRunsResponseSchema = apiResponseSchema(z.array(dqRunSchema));
export const dqRunResponseSchema = apiResponseSchema(dqRunSchema);
export const dqPresetsResponseSchema = apiResponseSchema(z.array(dqPresetSchema));
export const dqSummaryResponseSchema = apiResponseSchema(dqSummarySchema);
