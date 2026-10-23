import { z } from 'zod';
const suiteSchema = z.object({ runId: z.string(), startedAt: z.string(), finishedAt: z.string(), durationMs: z.number(), passedRules: z.number(), failedRules: z.number(), erroredRules: z.number(), totalRows: z.number() });
import { decodeRule, decodeRun, decodeSummary, decodeItems } from './dq.adapter';
import { apiClient } from '../api';
import { ENDPOINTS } from '../api/endpoints';
import type { ApiResponse } from '@/types/commons';
import type {
  DQRule,
  DQRuleCreatePayload,
  DQRuleUpdatePayload,
  DQRun,
  DQPreset,
  DQSummary,
} from '@/types/entities';

export interface ListRulesParams {
  tableName?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
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

export const dqService = {
  listRules: async (params: ListRulesParams = {}): Promise<ReadonlyArray<DQRule>> => {
    const res = await apiClient.get<ApiResponse<ReadonlyArray<DQRule>>>(
      ENDPOINTS.dq.rules,
      { params: { ...params, table: params.tableName } },
    );
    return decodeItems(res.data.data).map(decodeRule);
  },

  getRule: async (ruleId: string): Promise<DQRule> => {
    const res = await apiClient.get<ApiResponse<DQRule>>(
      ENDPOINTS.dq.rule(ruleId),
    );
    return decodeRule(res.data.data);
  },

  createRule: async (payload: DQRuleCreatePayload): Promise<DQRule> => {
    const res = await apiClient.post<ApiResponse<DQRule>>(
      ENDPOINTS.dq.rules,
      payload,
    );
    return res.data.data;
  },

  updateRule: async (ruleId: string, payload: DQRuleUpdatePayload): Promise<DQRule> => {
    const res = await apiClient.patch<ApiResponse<DQRule>>(
      ENDPOINTS.dq.rule(ruleId),
      payload,
    );
    return decodeRule(res.data.data);
  },

  deleteRule: async (ruleId: string): Promise<void> => {
    await apiClient.delete<ApiResponse<null>>(ENDPOINTS.dq.rule(ruleId));
  },

  runRule: async (ruleId: string): Promise<DQRun> => {
    const res = await apiClient.post<ApiResponse<DQRun>>(
      ENDPOINTS.dq.ruleRun(ruleId),
      {},
    );
    return decodeRun(res.data.data);
  },

  runSuite: async (payload: RunSuitePayload): Promise<DQRun> => {
    const res = await apiClient.post<ApiResponse<DQRun>>(
      ENDPOINTS.dq.runSuite,
      { ruleIds: payload.ruleIds },
    );
    const value = suiteSchema.parse(res.data.data);
    return { runId: value.runId, status: value.failedRules + value.erroredRules > 0 ? 'failed' : 'success',
      startedAt: value.startedAt, finishedAt: value.finishedAt, durationMs: value.durationMs,
      passedRules: value.passedRules, failedRules: value.failedRules + value.erroredRules, warningRules: 0, totalCheckedRows: value.totalRows };
  },

  getPresets: async (): Promise<ReadonlyArray<DQPreset>> => {
    const res = await apiClient.get<ApiResponse<ReadonlyArray<DQPreset>>>(
      ENDPOINTS.dq.presets,
    );
    return res.data.data;
  },

  listRuns: async (params: ListRunsParams = {}): Promise<ReadonlyArray<DQRun>> => {
    const res = await apiClient.get<ApiResponse<ReadonlyArray<DQRun>>>(
      ENDPOINTS.dq.runs,
      { params: { ...params } },
    );
    return decodeItems(res.data.data).map(decodeRun);
  },

  getRun: async (runId: string): Promise<DQRun> => {
    const res = await apiClient.get<ApiResponse<DQRun>>(ENDPOINTS.dq.run(runId));
    return decodeRun(res.data.data);
  },

  getSummary: async (): Promise<DQSummary> => {
    const res = await apiClient.get<ApiResponse<DQSummary>>(ENDPOINTS.dq.summary);
    return decodeSummary(res.data.data);
  },
};
