import type { DqRuleType, DqLayer, DqRunStatus, DqRunTrigger, DqSeverity } from './dq.enum';

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

export interface DqRuleExecution {
  ruleId: string;
  runId: string;
  status: DqRunStatus;
  totalRows: number;
  failedRows: number;
  passRate: number;
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
  passRate: number;
  errorMessage: string | null;
  durationMs: number;
  startedAt: string;
  finishedAt: string;
  suiteRunId: string | null;
}

export interface DqSuiteRun {
  runId: string;
  name: string;
  trigger: DqRunTrigger;
  totalRules: number;
  passedRules: number;
  failedRules: number;
  erroredRules: number;
  totalRows: number;
  failedRows: number;
  passRate: number;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  ruleRuns: DqRuleRun[];
}

export interface DqSummary {
  totalRules: number;
  enabledRules: number;
  totalRuns: number;
  passRate: number;
  byLayer: Array<{ layer: DqLayer; total: number; passed: number; failed: number; passRate: number }>;
  byStatus: Array<{ status: DqRunStatus; count: number }>;
  topFailedRules: Array<{ ruleId: string; ruleName: string; failCount: number; passRate: number }>;
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