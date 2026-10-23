import { decodeTask, decodeLogs, decodeGantt } from './airflow.adapter';
import { decodeDAG, decodeDAGRun, decodeAirflowStats, decodeAirflowItems } from './airflow.adapter';
import { apiClient } from '../api';
import { ENDPOINTS } from '../api/endpoints';
import type { ApiResponse } from '@/types/commons';
import type {
  AirflowDAG,
  AirflowDAGRun,
  AirflowTaskInstance,
  AirflowGanttEntry,
  AirflowTriggerResult,
  AirflowStats,
  AirflowTaskLogs,
} from '@/types/entities';

export interface ListDAGRunsParams {
  limit?: number;
  offset?: number;
  state?: 'success' | 'failed' | 'running' | 'queued';
  startDate?: string;
  endDate?: string;
}

export interface TriggerDAGPayload {
  conf?: Readonly<Record<string, unknown>>;
  executionDate?: string;
}

export const airflowService = {
  listDAGs: async (): Promise<ReadonlyArray<AirflowDAG>> => {
    const res = await apiClient.get<ApiResponse<ReadonlyArray<AirflowDAG>>>(
      ENDPOINTS.airflow.dags,
    );
    return decodeAirflowItems(res.data.data).map(decodeDAG);
  },

  getDAG: async (dagId: string): Promise<AirflowDAG> => {
    const res = await apiClient.get<ApiResponse<AirflowDAG>>(
      ENDPOINTS.airflow.dag(dagId),
    );
    return decodeDAG(res.data.data);
  },

  triggerDAG: async (dagId: string, payload: TriggerDAGPayload = {}): Promise<AirflowTriggerResult> => {
    const res = await apiClient.post<ApiResponse<AirflowTriggerResult>>(
      ENDPOINTS.airflow.dagTrigger(dagId),
      { conf: payload.conf ?? {}, logicalDate: payload.executionDate },
    );
    return res.data.data;
  },

  pauseDAG: async (dagId: string): Promise<void> => {
    await apiClient.post<ApiResponse<null>>(ENDPOINTS.airflow.dagPause(dagId), {});
  },

  unpauseDAG: async (dagId: string): Promise<void> => {
    await apiClient.post<ApiResponse<null>>(ENDPOINTS.airflow.dagUnpause(dagId), {});
  },

  listDAGRuns: async (
    dagId: string,
    params: ListDAGRunsParams = {},
  ): Promise<ReadonlyArray<AirflowDAGRun>> => {
    const res = await apiClient.get<ApiResponse<ReadonlyArray<AirflowDAGRun>>>(
      ENDPOINTS.airflow.dagRuns(dagId),
      { params: { limit: params.limit, offset: params.offset, state: params.state, startDateGte: params.startDate, startDateLte: params.endDate } },
    );
    return decodeAirflowItems(res.data.data).map(decodeDAGRun);
  },

  getDAGRun: async (dagId: string, runId: string): Promise<AirflowDAGRun> => {
    const res = await apiClient.get<ApiResponse<AirflowDAGRun>>(
      ENDPOINTS.airflow.dagRun(dagId, runId),
    );
    return decodeDAGRun(res.data.data);
  },

  deleteDAGRun: async (dagId: string, runId: string): Promise<void> => {
    await apiClient.delete<ApiResponse<null>>(
      ENDPOINTS.airflow.dagRun(dagId, runId),
    );
  },

  listDAGRunTasks: async (
    dagId: string,
    runId: string,
  ): Promise<ReadonlyArray<AirflowTaskInstance>> => {
    const res = await apiClient.get<ApiResponse<ReadonlyArray<AirflowTaskInstance>>>(
      ENDPOINTS.airflow.dagRunTasks(dagId, runId),
    );
    return decodeAirflowItems(res.data.data).map(decodeTask);
  },

  getTaskLogs: async (
    dagId: string,
    runId: string,
    taskId: string,
    tryNumber: number = 1,
  ): Promise<AirflowTaskLogs> => {
    const res = await apiClient.get<ApiResponse<AirflowTaskLogs>>(
      ENDPOINTS.airflow.dagRunTaskLogs(dagId, runId, taskId),
      { params: { tryNumber } },
    );
    return decodeLogs(res.data.data);
  },

  getDAGRunGantt: async (
    dagId: string,
    runId: string,
  ): Promise<ReadonlyArray<AirflowGanttEntry>> => {
    const res = await apiClient.get<ApiResponse<ReadonlyArray<AirflowGanttEntry>>>(
      ENDPOINTS.airflow.dagRunGantt(dagId, runId),
    );
    return decodeGantt(res.data.data);
  },

  getHealth: async (): Promise<unknown> => {
    const res = await apiClient.get<ApiResponse<unknown>>(ENDPOINTS.airflow.health);
    return res.data.data;
  },

  getStats: async (): Promise<AirflowStats> => {
    const res = await apiClient.get<ApiResponse<AirflowStats>>(ENDPOINTS.airflow.stats);
    return decodeAirflowStats(res.data.data);
  },
};
