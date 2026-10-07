import { z } from 'zod';
import { DQ_RULE_TYPE, DQ_LAYER, DQ_SEVERITY } from '../types';

const paramsSchema = z.record(z.string(), z.unknown()).default({});

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
  table: z.string().min(1).max(255),
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
    table: z.string().min(1).max(255).optional(),
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
  status: z.enum(['pass', 'fail', 'error']).optional(),
  trigger: z.enum(['manual', 'suite', 'scheduled']).optional(),
  suiteRunId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type TRunsListQuery = z.infer<typeof RunsListQuerySchema>;