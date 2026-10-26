import { z } from 'zod';
import {
  decodeApplicability,
  decodeFailedSamples,
  decodeItems,
  decodePresetApplyResult,
  decodePresets,
  decodeRule,
  decodeRun,
  decodeSummary,
} from './dq.adapter';
import { apiClient } from '../api';
import { ENDPOINTS } from '../api/endpoints';
import type { ApiResponse } from '@/types/commons';
import type {
  DQFailedSamples,
  DQPreset,
  DQPresetApplicability,
  DQPresetApplyResult,
  DQPresetTarget,
  DQRule,
  DQRuleCreatePayload,
  DQRuleUpdatePayload,
  DQRun,
  DQSummary,
  EDQOutcome,
  EDQSeverity,
} from '@/types/entities';

export interface ListRulesParams {
  tableName?: string;
  severity?: EDQSeverity;
  enabled?: boolean;
}

export interface ListRunsParams {
  limit?: number;
  offset?: number;
  ruleId?: string;
  status?: 'queued' | 'running' | 'success' | 'failed';
}

export interface RunSuitePayload {
  ruleIds: ReadonlyArray<string>;
}

/** The payload of the preset wizard — the target is a dataset column. */
export interface ApplyPresetPayload {
  target: DQPresetTarget;
  severity?: EDQSeverity;
  enabled?: boolean;
}

export const dqService = {
  listRules: async (params: ListRulesParams = {}): Promise<ReadonlyArray<DQRule>> => {
    const res = await apiClient.get<ApiResponse<{ items: unknown[]; total: number }>>(
      ENDPOINTS.dq.rules,
      { params: { ...params, table: params.tableName } },
    );
    return decodeItems(res.data.data).map(decodeRule);
  },

  getRule: async (ruleId: string): Promise<DQRule> => {
    const res = await apiClient.get<ApiResponse<unknown>>(ENDPOINTS.dq.rule(ruleId));
    return decodeRule(res.data.data);
  },

  createRule: async (payload: DQRuleCreatePayload): Promise<DQRule> => {
    const res = await apiClient.post<ApiResponse<unknown>>(ENDPOINTS.dq.rules, {
      name: payload.ruleName,
      type: RULE_TYPE_TO_API[payload.ruleType],
      layer: payload.layer ?? 'bronze',
      table: payload.tableName,
      ...(payload.columnName !== undefined ? { column: payload.columnName } : {}),
      params: parseExpression(payload.expression),
      severity: payload.severity,
      enabled: true,
      ...(payload.description !== undefined ? { description: payload.description } : {}),
    });
    return decodeRule(res.data.data);
  },

  updateRule: async (ruleId: string, payload: DQRuleUpdatePayload): Promise<DQRule> => {
    const res = await apiClient.patch<ApiResponse<unknown>>(
      ENDPOINTS.dq.rule(ruleId),
      {
        ...(payload.ruleName !== undefined ? { name: payload.ruleName } : {}),
        ...(payload.severity !== undefined ? { severity: payload.severity } : {}),
        ...(payload.expression !== undefined
          ? { params: parseExpression(payload.expression) }
          : {}),
        ...(payload.enabled !== undefined ? { enabled: payload.enabled } : {}),
        ...(payload.description !== undefined ? { description: payload.description } : {}),
      },
    );
    return decodeRule(res.data.data);
  },

  deleteRule: async (ruleId: string): Promise<void> => {
    await apiClient.delete<ApiResponse<null>>(ENDPOINTS.dq.rule(ruleId));
  },

  runRule: async (ruleId: string): Promise<DQRun> => {
    const res = await apiClient.post<ApiResponse<unknown>>(
      ENDPOINTS.dq.ruleRun(ruleId),
      {},
    );
    return decodeRun(res.data.data);
  },

  runSuite: async (payload: RunSuitePayload): Promise<DQRun> => {
    const res = await apiClient.post<ApiResponse<unknown>>(ENDPOINTS.dq.runSuite, {
      ruleIds: payload.ruleIds,
    });
    const value = suiteSchema.parse(res.data.data);
    return {
      runId: value.runId,
      status:
        value.failedRules + value.erroredRules > 0
          ? 'failed'
          : value.passedRules > 0
            ? 'success'
            : 'queued',
      startedAt: value.startedAt,
      finishedAt: value.finishedAt,
      durationMs: value.durationMs,
      passedRules: value.passedRules,
      failedRules: value.failedRules + value.erroredRules,
      warningRules: 0,
      totalCheckedRows: value.totalRows,
      outcome: (value.gateOutcome ?? (value.failedRules > 0 ? 'fail' : 'pass')) as EDQOutcome,
      evaluatedRows: value.evaluatedRows ?? 0,
      skippedRows: value.skippedRows ?? 0,
      passRate: value.passRate ?? null,
    };
  },

  getPresets: async (): Promise<ReadonlyArray<DQPreset>> => {
    const res = await apiClient.get<ApiResponse<{ items: unknown[]; total: number }>>(
      ENDPOINTS.dq.presets,
    );
    return decodePresets(res.data.data);
  },

  /**
   * Check whether a preset applies to a dataset column.
   *
   * The check is read-only; it never creates anything.
   */
  checkPreset: async (
    presetId: string,
    target: DQPresetTarget,
  ): Promise<DQPresetApplicability> => {
    const res = await apiClient.post<ApiResponse<unknown>>(
      ENDPOINTS.dq.presetCheck(presetId),
      { target },
    );
    return decodeApplicability(res.data.data);
  },

  /**
   * Apply a preset to a dataset column.
   *
   * The operation is idempotent on the server — a repeated apply returns
   * the existing rule (`existing: true`) instead of creating a duplicate.
   */
  applyPreset: async (
    presetId: string,
    payload: ApplyPresetPayload,
  ): Promise<DQPresetApplyResult> => {
    const res = await apiClient.post<ApiResponse<unknown>>(
      ENDPOINTS.dq.presetApply(presetId),
      {
        target: payload.target,
        ...(payload.severity !== undefined ? { severity: payload.severity } : {}),
        enabled: payload.enabled ?? false,
      },
    );
    return decodePresetApplyResult(res.data.data);
  },

  /** The bounded, PII-redacted failed samples of a run. */
  getFailedSamples: async (
    runId: string,
    limit = 10,
  ): Promise<DQFailedSamples> => {
    const res = await apiClient.get<ApiResponse<unknown>>(
      ENDPOINTS.dq.runSamples(runId),
      { params: { limit } },
    );
    return decodeFailedSamples(res.data.data);
  },

  listRuns: async (params: ListRunsParams = {}): Promise<ReadonlyArray<DQRun>> => {
    const res = await apiClient.get<ApiResponse<{ items: unknown[]; total: number }>>(
      ENDPOINTS.dq.runs,
      { params: { ...params } },
    );
    return decodeItems(res.data.data).map(decodeRun);
  },

  getRun: async (runId: string): Promise<DQRun> => {
    const res = await apiClient.get<ApiResponse<unknown>>(ENDPOINTS.dq.run(runId));
    return decodeRun(res.data.data);
  },

  getSummary: async (): Promise<DQSummary> => {
    const res = await apiClient.get<ApiResponse<unknown>>(ENDPOINTS.dq.summary);
    return decodeSummary(res.data.data);
  },
};

/** The suite response — the API returns the full suite aggregate. */
const suiteSchema = z.object({
  runId: z.string(),
  name: z.string().optional(),
  totalRules: z.number().optional(),
  passedRules: z.number().default(0),
  failedRules: z.number().default(0),
  erroredRules: z.number().default(0),
  warnedRules: z.number().default(0),
  totalRows: z.number().default(0),
  evaluatedRows: z.number().optional(),
  skippedRows: z.number().optional(),
  passRate: z.number().nullable().optional(),
  gateOutcome: z.string().optional(),
  startedAt: z.string(),
  finishedAt: z.string(),
  durationMs: z.number(),
});

/** The UI rule type → the API rule type. */
const RULE_TYPE_TO_API: Readonly<Record<string, string>> = {
  not_null: 'null_check',
  range: 'range_check',
  in_set: 'in_set',
  unique: 'unique',
  regex: 'regex',
  custom: 'custom_sql',
};

/**
 * Parse the `expression` of a UI rule.
 *
 * The UI stores the rule parameters as a JSON string. A non-JSON expression
 * is an empty parameter set — the API validates the parameters per rule
 * type and rejects an invalid combination with a clear error.
 */
function parseExpression(expression: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(expression);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fall through — an unparsable expression carries no parameters
  }
  return {};
}
