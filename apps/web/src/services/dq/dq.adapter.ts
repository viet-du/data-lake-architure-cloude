import { z } from 'zod';
import type {
  DQFailedSamples,
  DQPreset,
  DQPresetApplicability,
  DQPresetApplyResult,
  DQRule,
  DQRun,
  DQSummary,
  EDQOutcome,
  EDQRuleType,
  EDQSeverity,
} from '@/types/entities';

/**
 * The API → UI adapter for Data Quality.
 *
 * MASTER PLAN §06.1: the API is the source of truth for the *denominator*.
 * The adapter therefore keeps `null` as "not evaluated" everywhere and
 * never substitutes a fake 0/100% value. The API rule types are mapped to
 * the UI vocabulary (`null_check` → `not_null`, …) while the precise
 * outcome (`pass`/`fail`/`warn`/`error`/`not_evaluated`) is preserved in a
 * separate field — a technical error is never a pass.
 */

const RULE_TYPE_MAP: Readonly<Record<string, EDQRuleType>> = {
  null_check: 'not_null',
  range_check: 'range',
  in_set: 'in_set',
  unique: 'unique',
  regex: 'regex',
  custom_sql: 'custom',
};

const OUTCOME_MAP: Readonly<Record<string, EDQOutcome>> = {
  pass: 'pass',
  fail: 'fail',
  warn: 'warn',
  error: 'error',
  not_evaluated: 'not_evaluated',
};

const ruleSchema = z.object({
  ruleId: z.string(),
  name: z.string(),
  type: z.string(),
  table: z.string(),
  column: z.string().nullable().optional(),
  params: z.record(z.unknown()).default({}),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  enabled: z.boolean(),
  description: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  layer: z.enum(['bronze', 'silver', 'gold']).optional(),
  tags: z.array(z.string()).optional(),
});

export function decodeRule(input: unknown): DQRule {
  const v = ruleSchema.parse(input);
  const ruleType = RULE_TYPE_MAP[v.type] ?? 'custom';
  return {
    ruleId: v.ruleId,
    ruleName: v.name,
    tableName: v.table,
    ruleType,
    expression: JSON.stringify(v.params),
    severity: v.severity,
    enabled: v.enabled,
    // A rule without a run has no status — `unknown`, never a fake pass.
    status: 'unknown',
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
    ...(v.column ? { columnName: v.column } : {}),
    ...(v.description ? { description: v.description } : {}),
    ...(v.layer ? { layer: v.layer } : {}),
    ...(v.tags ? { tags: v.tags } : {}),
  };
}

const runSchema = z.object({
  runId: z.string(),
  ruleId: z.string().nullable().optional(),
  ruleName: z.string().optional(),
  status: z.string(),
  type: z.string().optional(),
  layer: z.enum(['bronze', 'silver', 'gold']).optional(),
  table: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  totalRows: z.number().default(0),
  failedRows: z.number().default(0),
  evaluatedRows: z.number().default(0),
  skippedRows: z.number().default(0),
  passRate: z.number().nullable().optional(),
  coverageRate: z.number().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  durationMs: z.number().optional(),
  suiteRunId: z.string().nullable().optional(),
});

export function decodeRun(input: unknown): DQRun {
  const v = runSchema.parse(input);
  const outcome = OUTCOME_MAP[v.status] ?? 'not_evaluated';
  return {
    runId: v.runId,
    // `queued`/`running` are the legacy lifecycle states; a DQ run that
    // reached the server is already finished, so only the outcome matters.
    status:
      outcome === 'pass' ? 'success' : outcome === 'not_evaluated' ? 'queued' : 'failed',
    startedAt: v.startedAt,
    ...(v.finishedAt ? { finishedAt: v.finishedAt } : {}),
    ...(v.durationMs !== undefined ? { durationMs: v.durationMs } : {}),
    passedRules: outcome === 'pass' ? 1 : 0,
    failedRules: outcome === 'fail' ? 1 : 0,
    warningRules: outcome === 'warn' ? 1 : 0,
    totalCheckedRows: v.totalRows,
    outcome,
    ...(v.ruleId ? { ruleId: v.ruleId } : {}),
    ...(v.ruleName ? { ruleName: v.ruleName } : {}),
    ...(v.layer ? { layer: v.layer } : {}),
    ...(v.table ? { table: v.table } : {}),
    ...(v.severity ? { severity: v.severity } : {}),
    evaluatedRows: v.evaluatedRows,
    skippedRows: v.skippedRows,
    passRate: v.passRate ?? null,
    coverageRate: v.coverageRate ?? null,
    ...(v.errorMessage ? { errorMessage: v.errorMessage } : {}),
  };
}

const summarySchema = z.object({
  totalRules: z.number(),
  enabledRules: z.number().optional(),
  totalRuns: z.number().optional(),
  passRate: z.number().nullable().optional(),
  status: z.string().optional(),
  evaluatedRows: z.number().optional(),
  skippedRows: z.number().optional(),
  coverageRate: z.number().nullable().optional(),
  byStatus: z
    .array(
      z.object({
        status: z.string(),
        count: z.number(),
      }),
    )
    .default([]),
  byLayer: z
    .array(
      z.object({
        layer: z.string(),
        total: z.number(),
        passed: z.number(),
        failed: z.number(),
        warned: z.number(),
        errored: z.number(),
        notEvaluated: z.number(),
        evaluated: z.number(),
        passRate: z.number().nullable(),
      }),
    )
    .optional(),
  topFailedRules: z
    .array(
      z.object({
        ruleId: z.string(),
        ruleName: z.string(),
        failCount: z.number(),
        passRate: z.number().nullable(),
      }),
    )
    .optional(),
  recentRuns: z
    .array(
      z.object({
        runId: z.string(),
        startedAt: z.string(),
        status: z.string().optional(),
      }),
    )
    .default([]),
});

export function decodeSummary(input: unknown): DQSummary {
  const v = summarySchema.parse(input);
  const countOf = (status: string): number =>
    v.byStatus.find((entry) => entry.status === status)?.count ?? 0;
  const passing = countOf('pass');
  const failing = countOf('fail');
  const warning = countOf('warn');
  const errored = countOf('error');
  const evaluated = passing + failing + warning + errored;

  // §06.1: the pass rate is `null` until at least one rule was evaluated.
  // The API already computes it; the adapter only guards the empty case.
  const passRate =
    evaluated === 0 ? null : v.passRate === null || v.passRate === undefined ? null : v.passRate;

  const outcome = (OUTCOME_MAP[v.status ?? ''] ?? (evaluated === 0 ? 'not_evaluated' : 'pass')) as EDQOutcome;

  const overallStatus =
    outcome === 'not_evaluated'
      ? 'unknown'
      : outcome === 'fail' || outcome === 'error'
        ? 'unhealthy'
        : outcome === 'warn'
          ? 'degraded'
          : 'healthy';

  return {
    totalRules: v.totalRules,
    passing,
    failing,
    warning,
    passRate,
    overallStatus,
    status: outcome,
    ...(v.enabledRules !== undefined ? { enabledRules: v.enabledRules } : {}),
    ...(v.totalRuns !== undefined ? { totalRuns: v.totalRuns } : {}),
    ...(v.recentRuns[0] ? { lastRunAt: v.recentRuns[0].startedAt } : {}),
    ...(v.evaluatedRows !== undefined ? { evaluatedRows: v.evaluatedRows } : {}),
    ...(v.skippedRows !== undefined ? { skippedRows: v.skippedRows } : {}),
    ...(v.coverageRate !== undefined ? { coverageRate: v.coverageRate } : {}),
  };
}

export function decodeItems(input: unknown): unknown[] {
  return z.object({ items: z.array(z.unknown()), total: z.number() }).parse(input).items;
}

const presetSchema = z.object({
  presetId: z.string(),
  name: z.string(),
  description: z.string(),
  layer: z.enum(['bronze', 'silver', 'gold']).optional(),
  tableHint: z.string().nullable().optional(),
  type: z.string().optional(),
  params: z.record(z.unknown()).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  tags: z.array(z.string()).optional(),
});

export function decodePreset(input: unknown): DQPreset {
  const v = presetSchema.parse(input);
  return {
    presetId: v.presetId,
    name: v.name,
    description: v.description,
    ...(v.layer ? { layer: v.layer } : {}),
    ...(v.tableHint !== undefined ? { tableHint: v.tableHint } : {}),
    ...(v.type ? { type: RULE_TYPE_MAP[v.type] ?? 'custom' } : {}),
    ...(v.params ? { params: v.params } : {}),
    ...(v.severity ? { severity: v.severity } : {}),
    ...(v.tags ? { tags: v.tags } : {}),
  };
}

export function decodePresets(input: unknown): ReadonlyArray<DQPreset> {
  const items = decodeItems(input);
  return items.map(decodePreset);
}

const applicabilitySchema = z.object({
  presetId: z.string(),
  applicable: z.boolean(),
  column: z.string().nullable(),
  columnType: z.string().nullable(),
  columnKind: z.string().nullable(),
  reasons: z.array(z.string()),
});

export function decodeApplicability(input: unknown): DQPresetApplicability {
  const v = applicabilitySchema.parse(input);
  return {
    presetId: v.presetId,
    applicable: v.applicable,
    column: v.column,
    columnType: v.columnType,
    columnKind:
      v.columnKind === null
        ? null
        : (v.columnKind as DQPresetApplicability['columnKind']),
    reasons: v.reasons,
  };
}

export function decodePresetApplyResult(input: unknown): DQPresetApplyResult {
  const v = z
    .object({
      presetId: z.string(),
      rule: z.unknown(),
      existing: z.boolean(),
      availableColumns: z.array(z.string()).default([]),
    })
    .parse(input);
  return {
    presetId: v.presetId,
    rule: decodeRule(v.rule),
    existing: v.existing,
    availableColumns: v.availableColumns,
  };
}

const failedSamplesSchema = z.object({
  runId: z.string(),
  ruleId: z.string().nullable(),
  status: z.string(),
  total: z.number(),
  returned: z.number(),
  truncated: z.boolean(),
  columns: z.array(z.string()).default([]),
  rows: z.array(z.record(z.unknown())).default([]),
});

export function decodeFailedSamples(input: unknown): DQFailedSamples {
  const v = failedSamplesSchema.parse(input);
  return {
    runId: v.runId,
    ruleId: v.ruleId,
    status: (OUTCOME_MAP[v.status] ?? 'not_evaluated') as EDQOutcome,
    total: v.total,
    returned: v.returned,
    truncated: v.truncated,
    columns: v.columns,
    rows: v.rows,
  };
}

/** The severity vocabulary, used by the wizard. */
export const DQ_SEVERITIES: ReadonlyArray<EDQSeverity> = [
  'low',
  'medium',
  'high',
  'critical',
];
