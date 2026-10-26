import { z } from 'zod';
import { DQ_RULE_TYPE, DQ_LAYER, DQ_SEVERITY, DQ_RUN_STATUS } from '../types';
import { parseDatasetReference } from '../executors/dataset-reference';

const paramsSchema = z.record(z.string(), z.unknown()).default({});

const ruleTableSchema = z
  .string()
  .min(1)
  .max(255)
  .refine((value) => parseDatasetReference(value) !== null, {
    message: 'table must be "database.table", "database/table" or a bare table name',
  });

export const RuleIdParamSchema = z.object({
  ruleId: z.string().min(1).max(120).regex(/^[a-zA-Z0-9_-]+$/, 'ruleId must be alphanumeric with _ -'),
});

export type TRuleIdParam = z.infer<typeof RuleIdParamSchema>;

export const RunIdParamSchema = z.object({
  runId: z.string().min(1).max(120),
});

export type TRunIdParam = z.infer<typeof RunIdParamSchema>;

export const CreateRuleBodySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  type: z.enum(DQ_RULE_TYPE),
  layer: z.enum(DQ_LAYER),
  table: ruleTableSchema,
  column: z.string().max(255).optional(),
  params: paramsSchema,
  severity: z.enum(DQ_SEVERITY).default('medium'),
  enabled: z.boolean().default(true),
  tags: z.array(z.string().min(1).max(64)).max(20).default([]),
});

export type TCreateRuleBody = z.infer<typeof CreateRuleBodySchema>;

export const UpdateRuleBodySchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(2000).nullable().optional(),
    type: z.enum(DQ_RULE_TYPE).optional(),
    layer: z.enum(DQ_LAYER).optional(),
    table: ruleTableSchema.optional(),
    column: z.string().max(255).nullable().optional(),
    params: paramsSchema.optional(),
    severity: z.enum(DQ_SEVERITY).optional(),
    enabled: z.boolean().optional(),
    tags: z.array(z.string().min(1).max(64)).max(20).optional(),
  })
  .strict();

export type TUpdateRuleBody = z.infer<typeof UpdateRuleBodySchema>;

export const RuleListQuerySchema = z.object({
  layer: z.enum(DQ_LAYER).optional(),
  type: z.enum(DQ_RULE_TYPE).optional(),
  enabled: z.coerce.boolean().optional(),
  severity: z.enum(DQ_SEVERITY).optional(),
  table: z.string().optional(),
  tag: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export type TRuleListQuery = z.infer<typeof RuleListQuerySchema>;

export const RunRuleBodySchema = z.object({
  partition: z.string().max(255).optional(),
  runId: z.string().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(10_000).default(1000),
  sampleSize: z.coerce.number().int().min(1).max(100).default(10),
});

export type TRunRuleBody = z.infer<typeof RunRuleBodySchema>;

export const RunSuiteBodySchema = z.object({
  name: z.string().min(1).max(255).default('ad-hoc-suite'),
  ruleIds: z.array(z.string().min(1).max(120)).min(1).max(200),
  partition: z.string().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(10_000).default(1000),
  sampleSize: z.coerce.number().int().min(1).max(100).default(10),
});

export type TRunSuiteBody = z.infer<typeof RunSuiteBodySchema>;

export const RunsListQuerySchema = z.object({
  ruleId: z.string().optional(),
  layer: z.enum(DQ_LAYER).optional(),
  status: z.enum(DQ_RUN_STATUS).optional(),
  trigger: z.enum(['manual', 'suite', 'scheduled']).optional(),
  suiteRunId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type TRunsListQuery = z.infer<typeof RunsListQuerySchema>;

/**
 * The preset check/apply contract.
 *
 * MASTER PLAN DQ-009: the preset wizard "checks columns/type, applies
 * idempotently to selected dataset/version, asks confirm".
 */
export const PresetIdParamSchema = z.object({
  presetId: z.string().min(1).max(120).regex(/^[a-zA-Z0-9_-]+$/, 'invalid presetId'),
});

export type TPresetIdParam = z.infer<typeof PresetIdParamSchema>;

export const PresetTargetSchema = z.object({
  layer: z.enum(DQ_LAYER),
  /** The dataset — `database.table` or a bare table name. */
  table: z.string().min(1).max(255),
  /** The column the preset checks. */
  column: z.string().min(1).max(255).optional(),
});

export type TPresetTarget = z.infer<typeof PresetTargetSchema>;

export const PresetCheckBodySchema = z.object({
  target: PresetTargetSchema,
});

export type TPresetCheckBody = z.infer<typeof PresetCheckBodySchema>;

export const PresetApplyBodySchema = z.object({
  target: PresetTargetSchema,
  /** Overrides the preset severity. */
  severity: z.enum(DQ_SEVERITY).optional(),
  /** Whether the rule is enabled right away. Defaults to `false` (draft). */
  enabled: z.boolean().default(false),
});

export type TPresetApplyBody = z.infer<typeof PresetApplyBodySchema>;

/**
 * The failed-sample query.
 *
 * MASTER PLAN §06.5: the cap is configurable between 1 and 100 rows.
 */
export const RunSamplesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export type TRunSamplesQuery = z.infer<typeof RunSamplesQuerySchema>;