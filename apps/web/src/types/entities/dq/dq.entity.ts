import type { EHealthStatus } from '@/types/commons';

export type EDQRuleType = 'not_null' | 'unique' | 'range' | 'regex' | 'custom';
export type EDQSeverity = 'low' | 'medium' | 'high' | 'critical';
export type EDQStatus = 'pass' | 'fail' | 'warning';

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
}

export interface DQRuleCreatePayload {
  tableName: string;
  ruleName: string;
  ruleType: EDQRuleType;
  severity: EDQSeverity;
  columnName?: string;
  expression: string;
  description?: string;
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
}

export interface DQPreset {
  presetId: string;
  name: string;
  description: string;
  rules: ReadonlyArray<Omit<DQRule, 'ruleId' | 'tableName' | 'createdAt' | 'updatedAt'>>;
}

export interface DQSummary {
  totalRules: number;
  passing: number;
  failing: number;
  warning: number;
  lastRunAt?: string;
  overallStatus: EHealthStatus;
  bySeverity: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}
