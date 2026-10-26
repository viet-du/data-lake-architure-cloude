import type {
  DqRuleType,
  DqLayer,
  DqRunStatus,
  DqRunTrigger,
  DqSeverity,
  DqGateOutcome,
} from './dq.enum';

export interface DqRule {
  ruleId: string;
  name: string;
  description: string | null;
  type: DqRuleType;
  layer: DqLayer;
  table: string;
  column: string | null;
  params: Record<string, unknown>;
  severity: DqSeverity;
  enabled: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DqRuleInput {
  name: string;
  description?: string;
  type: DqRuleType;
  layer: DqLayer;
  table: string;
  column?: string;
  params: Record<string, unknown>;
  severity?: DqSeverity;
  enabled?: boolean;
  tags?: string[];
}

/**
 * Result of one rule evaluation.
 *
 * MASTER PLAN §06.1 DQ-006: the denominator must be explicit. The executor
 * distinguishes the rows that were actually evaluated from the rows that were
 * skipped because the column was NULL, and reports the coverage separately.
 */
export interface DqRuleExecution {
  ruleId: string;
  runId: string;
  status: DqRunStatus;
  /** Total rows present in the scanned dataset. */
  totalRows: number;
  /** Rows that failed the rule. */
  failedRows: number;
  /** Rows the rule was actually applied to (denominator). */
  evaluatedRows: number;
  /** Rows skipped because the checked column was NULL. */
  skippedRows: number;
  /** `failedRows / evaluatedRows` — null when nothing could be evaluated. */
  passRate: number | null;
  /** `evaluatedRows / totalRows` — how much of the dataset was covered. */
  coverageRate: number;
  sampleFailures: Array<Record<string, unknown>>;
  errorMessage: string | null;
  durationMs: number;
  executedAt: string;
}

export interface DqRuleRun {
  runId: string;
  ruleId: string | null;
  ruleName: string;
  type: DqRuleType;
  layer: DqLayer;
  table: string;
  status: DqRunStatus;
  trigger: DqRunTrigger;
  severity: DqSeverity;
  totalRows: number;
  failedRows: number;
  evaluatedRows: number;
  skippedRows: number;
  /** null means "not evaluated" — never a fake 0 or 1. */
  passRate: number | null;
  coverageRate: number;
  errorMessage: string | null;
  durationMs: number;
  startedAt: string;
  finishedAt: string;
  suiteRunId: string | null;
  /** Delta snapshot version the rule was evaluated against. */
  dataVersion?: number | null;
  sampleFailures?: Array<Record<string, unknown>>;
}

export interface DqSuiteRun {
  runId: string;
  name: string;
  trigger: DqRunTrigger;
  totalRules: number;
  passedRules: number;
  failedRules: number;
  warnedRules: number;
  erroredRules: number;
  totalRows: number;
  failedRows: number;
  evaluatedRows: number;
  skippedRows: number;
  /** Rule-execution pass rate — errors are NOT counted as passes. */
  passRate: number | null;
  /** Record validity rate — a different denominator (see §06.4). */
  recordValidityRate: number | null;
  /** Gate outcome of the suite; `not_evaluated` when nothing ran. */
  gateOutcome: DqGateOutcome;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  ruleRuns: DqRuleRun[];
}

export interface DqSummary {
  totalRules: number;
  enabledRules: number;
  totalRuns: number;
  /** null when no rule has been evaluated — never a fake 100%. */
  passRate: number | null;
  /** `not_evaluated` while there is no evidence of quality. */
  status: DqGateOutcome;
  /** The rows that were actually evaluated (the denominator). */
  evaluatedRows: number;
  /** The rows that were skipped because the checked column was NULL. */
  skippedRows: number;
  /** `evaluatedRows / totalRows` — how much of the data the gate saw. */
  coverageRate: number | null;
  byLayer: Array<{
    layer: DqLayer;
    total: number;
    passed: number;
    failed: number;
    warned: number;
    errored: number;
    notEvaluated: number;
    evaluated: number;
    passRate: number | null;
  }>;
  byStatus: Array<{ status: DqRunStatus; count: number }>;
  topFailedRules: Array<{ ruleId: string; ruleName: string; failCount: number; passRate: number | null }>;
  recentRuns: DqRuleRun[];
}

export interface DqPreset {
  presetId: string;
  name: string;
  description: string;
  layer: DqLayer;
  tableHint: string | null;
  type: DqRuleType;
  params: Record<string, unknown>;
  severity: DqSeverity;
  tags: string[];
}
