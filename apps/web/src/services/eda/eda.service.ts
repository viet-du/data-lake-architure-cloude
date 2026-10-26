import { apiClient } from '../api';
import { ENDPOINTS } from '../api/endpoints';
import type { ApiResponse } from '@/types/commons';
import type {
  ECompareProfilesPayload,
  ECreateProfilePayload,
  EDatasetProfile,
  EProfileAccepted,
  EProfileChart,
  EProfileComparison,
  EProfileListResult,
  EProfileSample,
  EProposeRulePayload,
  EProposedRule,
} from '@/types/entities';
import {
  decodeProfile,
  decodeProfileAccepted,
  decodeProfileChart,
  decodeProfileCharts,
  decodeProfileColumns,
  decodeProfileComparison,
  decodeProfileList,
  decodeProfileSample,
  decodeProposedRule,
} from './eda.adapter';

export interface ListProfilesParams {
  datasetId?: string;
  status?: 'queued' | 'running' | 'succeeded' | 'partial' | 'failed';
  limit?: number;
  offset?: number;
}

export interface ListColumnsParams {
  limit?: number;
  offset?: number;
}

/**
 * The EDA service.
 *
 * Every call names a *dataset*, never a path — the server resolves the
 * storage location through the shared `DatasetResolver`, so a browser can
 * never point the profiler at an arbitrary location.
 */
export const edaService = {
  listProfiles: async (params: ListProfilesParams = {}): Promise<EProfileListResult> => {
    const res = await apiClient.get<ApiResponse<unknown>>(ENDPOINTS.eda.profiles, {
      params: {
        ...(params.datasetId !== undefined ? { datasetId: params.datasetId } : {}),
        ...(params.status !== undefined ? { status: params.status } : {}),
        limit: params.limit ?? 50,
        offset: params.offset ?? 0,
      },
    });
    return decodeProfileList(res.data.data);
  },

  getProfile: async (profileId: string): Promise<EDatasetProfile> => {
    const res = await apiClient.get<ApiResponse<unknown>>(
      ENDPOINTS.eda.profile(profileId),
    );
    return decodeProfile(res.data.data);
  },

  createProfile: async (payload: ECreateProfilePayload): Promise<EProfileAccepted> => {
    const res = await apiClient.post<ApiResponse<unknown>>(ENDPOINTS.eda.profiles, {
      dataset: {
        ...(payload.dataset.datasetId !== undefined
          ? { datasetId: payload.dataset.datasetId }
          : {}),
        ...(payload.dataset.provider !== undefined
          ? { provider: payload.dataset.provider }
          : {}),
        ...(payload.dataset.layer !== undefined ? { layer: payload.dataset.layer } : {}),
        ...(payload.dataset.database !== undefined
          ? { database: payload.dataset.database }
          : {}),
        ...(payload.dataset.table !== undefined ? { table: payload.dataset.table } : {}),
      },
      ...(payload.version !== undefined ? { version: payload.version } : {}),
      columns: payload.columns,
      analyses: payload.analyses,
      includeCorrelation: payload.includeCorrelation,
      samplePolicy: payload.samplePolicy,
      ...(payload.sampleSize !== undefined ? { sampleSize: payload.sampleSize } : {}),
      ...(payload.seed !== undefined ? { seed: payload.seed } : {}),
      ...(payload.filters !== undefined ? { filters: payload.filters } : {}),
    });
    return decodeProfileAccepted(res.data.data);
  },

  listColumns: async (
    profileId: string,
    params: ListColumnsParams = {},
  ): Promise<{ profileId: string; total: number; columns: ReadonlyArray<unknown> }> => {
    const res = await apiClient.get<ApiResponse<unknown>>(
      ENDPOINTS.eda.profileColumns(profileId),
      { params: { limit: params.limit ?? 100, offset: params.offset ?? 0 } },
    );
    return decodeProfileColumns(res.data.data);
  },

  listCharts: async (profileId: string): Promise<ReadonlyArray<EProfileChart>> => {
    const res = await apiClient.get<ApiResponse<unknown>>(
      ENDPOINTS.eda.profileCharts(profileId),
    );
    return decodeProfileCharts(res.data.data);
  },

  getChart: async (profileId: string, chartId: string): Promise<EProfileChart> => {
    const res = await apiClient.get<ApiResponse<unknown>>(
      ENDPOINTS.eda.profileChart(profileId, chartId),
    );
    return decodeProfileChart(res.data.data);
  },

  getSample: async (profileId: string, limit = 20): Promise<EProfileSample> => {
    const res = await apiClient.get<ApiResponse<unknown>>(
      ENDPOINTS.eda.profileSample(profileId),
      { params: { limit } },
    );
    return decodeProfileSample(res.data.data);
  },

  compare: async (payload: ECompareProfilesPayload): Promise<EProfileComparison> => {
    const res = await apiClient.post<ApiResponse<unknown>>(ENDPOINTS.eda.compare, {
      profileId: payload.profileId,
      baselineProfileId: payload.baselineProfileId,
    });
    return decodeProfileComparison(res.data.data);
  },

  proposeRule: async (payload: EProposeRulePayload): Promise<EProposedRule> => {
    const res = await apiClient.post<ApiResponse<unknown>>(ENDPOINTS.eda.proposeRule, {
      profileId: payload.profileId,
      column: payload.column,
      type: payload.type,
      ...(payload.threshold !== undefined ? { threshold: payload.threshold } : {}),
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      enabled: payload.enabled ?? false,
    });
    return decodeProposedRule(res.data.data);
  },
};
