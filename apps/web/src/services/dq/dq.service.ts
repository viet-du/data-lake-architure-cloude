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
  ruleIds?: ReadonlyArray<string>;
  tables?: ReadonlyArray<string>;
  parallel?: number;
}

export const dqService = {
  listRules: async (params: ListRulesParams = {}): Promise<ReadonlyArray<DQRule>> => {
    const res = await apiClient.get<ApiResponse<ReadonlyArray<DQRule>>>(
      ENDPOINTS.dq.rules,
      { params: { ...params } },
    );
    return res.data.data;
  },

  getRule: async (ruleId: string): Promise<DQRule> => {
    const res = await apiClient.get<ApiResponse<DQRule>>(
      ENDPOINTS.dq.rule(ruleId),
    );
    return res.data.data;
  },

  createRule: async (payload: DQRuleCreatePayload): Promise<DQRule> => {
    const res = await apiClient.post<ApiResponse<DQRule>>(
      ENDPOINTS.dq.rules,
      payload,
    );
    return res.data.data;
  },

  updateRule: async (ruleId: string, payload: DQRuleUpdatePayload): Promise<DQRule> => {
    const res = await apiClient.put<ApiResponse<DQRule>>(
      ENDPOINTS.dq.rule(ruleId),
      payload,
    );
    return res.data.data;
  },

  deleteRule: async (ruleId: string): Promise<void> => {
    await apiClient.delete<ApiResponse<null>>(ENDPOINTS.dq.rule(ruleId));
  },

  runRule: async (ruleId: string): Promise<DQRun> => {
    const res = await apiClient.post<ApiResponse<DQRun>>(
      ENDPOINTS.dq.ruleRun(ruleId),
      {},
    );
    return res.data.data;
  },

  runSuite: async (payload: RunSuitePayload = {}): Promise<DQRun> => {
    const res = await apiClient.post<ApiResponse<DQRun>>(
      ENDPOINTS.dq.runSuite,
      payload,
    );
    return res.data.data;
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
    return res.data.data;
  },

  getRun: async (runId: string): Promise<DQRun> => {
    const res = await apiClient.get<ApiResponse<DQRun>>(ENDPOINTS.dq.run(runId));
    return res.data.data;
  },

  getSummary: async (): Promise<DQSummary> => {
    const res = await apiClient.get<ApiResponse<DQSummary>>(ENDPOINTS.dq.summary);
    return res.data.data;
  },
};
