import { apiClient } from '../api';
import { ENDPOINTS } from '../api/endpoints';
import {
  decodeActivity,
  decodeDependencies,
  decodeSummary,
} from './dashboard.adapter';
import type { ApiResponse } from '@/types/commons';
import type {
  DashboardActivity,
  DashboardDependencies,
  DashboardSummary,
} from '@/types/entities';
import type { EDashboardQualityWindow } from '@/store';

export interface DashboardSummaryParams {
  scope?: string;
  /**
   * The quality measurement window.
   *
   * Only the two windows the backend implements are sent: `all` (every
   * evaluated run) and `24h` (the rolling last day). The parameter is
   * omitted when it is the default, so the default request is identical
   * to the one the API has always answered.
   */
  window?: EDashboardQualityWindow;
}

export interface DashboardActivityParams {
  cursor?: string;
  limit?: number;
  kind?: string;
  status?: string;
  datasetId?: string;
}

export const dashboardService = {
  /**
   * The Home KPI summary.
   *
   * One request replaces the eight-request fan-out the Home screen used to
   * issue. Every metric carries its own provenance, so the UI can show a
   * degraded metric next to a healthy one instead of hiding the whole card.
   */
  getSummary: async (params: DashboardSummaryParams = {}): Promise<DashboardSummary> => {
    const res = await apiClient.get<ApiResponse<unknown>>(ENDPOINTS.dashboard.summary, {
      params,
    });
    return decodeSummary(res.data.data);
  },

  /**
   * The activity feed.
   *
   * The feed is cursor-paged. `nextCursor` is passed back verbatim as the
   * `cursor` of the next request.
   */
  getActivity: async (params: DashboardActivityParams = {}): Promise<DashboardActivity> => {
    const res = await apiClient.get<ApiResponse<unknown>>(ENDPOINTS.dashboard.activity, {
      params,
    });
    return decodeActivity(res.data.data);
  },

  /** The capability-aware dependency view. */
  getDependencies: async (): Promise<DashboardDependencies> => {
    const res = await apiClient.get<ApiResponse<unknown>>(ENDPOINTS.dashboard.dependencies);
    return decodeDependencies(res.data.data);
  },
};
