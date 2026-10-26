import type { EHealthStatus } from '@/types/commons';

export type EDQRuleType =
  | 'not_null'
  | 'unique'
  | 'range'
  | 'regex'
  | 'custom'
  | 'in_set';
export type EDQSeverity = 'low' | 'medium' | 'high' | 'critical';
export type EDQStatus = 'pass' | 'fail' | 'warning' | 'unknown';
/**
 * The outcome of one DQ evaluation.
 *
 * MASTER PLAN §06.1 DQ-007: `error` and `not_evaluated` are *not* passes.
 * `not_evaluated` means "no evidence yet" — it must never be rendered as
 * a 100% pass rate.
 */
export type EDQOutcome = 'pass' | 'fail' | 'warn' | 'error' | 'not_evaluated';
export type EDQLayer = 'bronze' | 'silver' | 'gold';

export interface DQRule {
  ruleId: string;
  tableName: string;
  ruleName: string;
  ruleType: EDQRuleType;
  severity: EDQSeverity;
  status: EDQStatus;
  columnName?: string;
  expression: string;
  enabled: boolean;
  lastRunAt?: string;
  lastRunResult?: EDQStatus;
  failedRows?: number;
  totalRows?: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
  /** The medallion layer the rule belongs to. */
  layer?: EDQLayer;
  /** The tags of the rule — a preset rule carries its identity tag. */
  tags?: ReadonlyArray<string>;
}

export interface DQRuleCreatePayload {
  tableName: string;
  ruleName: string;
  ruleType: EDQRuleType;
  severity: EDQSeverity;
  columnName?: string;
  expression: string;
  description?: string;
  /** The medallion layer the rule belongs to. */
  layer?: EDQLayer;
}

export interface DQRuleUpdatePayload {
  ruleName?: string;
  severity?: EDQSeverity;
  expression?: string;
  enabled?: boolean;
  description?: string;
}

export interface DQRun {
  runId: string;
  ruleId?: string;
  status: 'queued' | 'running' | 'success' | 'failed';
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  passedRules: number;
  failedRules: number;
  warningRules: number;
  totalCheckedRows: number;
  errorMessage?: string;
  /** The precise DQ outcome — `warn`/`error`/`not_evaluated` are not passes. */
  outcome?: EDQOutcome;
  ruleName?: string;
  layer?: EDQLayer;
  table?: string;
  severity?: EDQSeverity;
  /** Rows the rule was actually applied to (the denominator). */
  evaluatedRows?: number;
  /** Rows skipped because the checked column was NULL. */
  skippedRows?: number;
  /** `failedRows / evaluatedRows` — `null` when nothing was evaluated. */
  passRate?: number | null;
  /** `evaluatedRows / totalRows`. */
  coverageRate?: number | null;
}

/**
 * A DQ preset template.
 *
 * The preset is a *template*, never an applied rule: applying it happens
 * through the wizard (check → confirm → apply), which creates exactly one
 * idempotent rule for the selected dataset column.
 */
export interface DQPreset {
  presetId: string;
  name: string;
  description: string;
  layer?: EDQLayer;
  tableHint?: string | null;
  type?: EDQRuleType;
  params?: Record<string, unknown>;
  severity?: EDQSeverity;
  tags?: ReadonlyArray<string>;
}

/** The dataset a preset is checked against / applied to. */
export interface DQPresetTarget {
  layer: EDQLayer;
  table: string;
  column?: string;
}

/**
 * The applicability report of a preset.
 *
 * `applicable` is false whenever `reasons` is non-empty — the reasons are
 * shown to the user verbatim, so the wizard never applies a preset blindly.
 */
export interface DQPresetApplicability {
  presetId: string;
  applicable: boolean;
  column: string | null;
  columnType: string | null;
  columnKind: 'numeric' | 'string' | 'temporal' | 'boolean' | 'other' | null;
  reasons: ReadonlyArray<string>;
}

/** The result of applying a preset — `existing` means it was already there. */
export interface DQPresetApplyResult {
  presetId: string;
  rule: DQRule;
  existing: boolean;
  availableColumns: ReadonlyArray<string>;
}

/** A bounded, PII-redacted failed sample set. */
export interface DQFailedSamples {
  runId: string;
  ruleId: string | null;
  status: EDQOutcome;
  total: number;
  returned: number;
  truncated: boolean;
  columns: ReadonlyArray<string>;
  rows: ReadonlyArray<Record<string, unknown>>;
}

export interface DQSummary {
  passRate: number | null;
  totalRules: number;
  passing: number;
  failing: number;
  warning?: number;
  lastRunAt?: string;
  overallStatus: EHealthStatus;
  bySeverity?: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  /** The quality-gate outcome — `not_evaluated` when nothing ran. */
  status?: EDQOutcome;
  enabledRules?: number;
  totalRuns?: number;
  /** The rows that were actually evaluated (the denominator). */
  evaluatedRows?: number;
  /** The rows that were skipped because the checked column was NULL. */
  skippedRows?: number;
  /** The share of rows that were evaluated at all. */
  coverageRate?: number | null;
}
