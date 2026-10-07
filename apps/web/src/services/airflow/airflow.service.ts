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
    return res.data.data;
  },

  getDAG: async (dagId: string): Promise<AirflowDAG> => {
    const res = await apiClient.get<ApiResponse<AirflowDAG>>(
      ENDPOINTS.airflow.dag(dagId),
    );
    return res.data.data;
  },

  triggerDAG: async (dagId: string, payload: TriggerDAGPayload = {}): Promise<AirflowTriggerResult> => {
    const res = await apiClient.post<ApiResponse<AirflowTriggerResult>>(
      ENDPOINTS.airflow.dagTrigger(dagId),
      payload,
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
      { params: { ...params } },
    );
    return res.data.data;
  },

  getDAGRun: async (dagId: string, runId: string): Promise<AirflowDAGRun> => {
    const res = await apiClient.get<ApiResponse<AirflowDAGRun>>(
      ENDPOINTS.airflow.dagRun(dagId, runId),
    );
    return res.data.data;
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
    return res.data.data;
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
    return res.data.data;
  },

  getDAGRunGantt: async (
    dagId: string,
    runId: string,
  ): Promise<ReadonlyArray<AirflowGanttEntry>> => {
    const res = await apiClient.get<ApiResponse<ReadonlyArray<AirflowGanttEntry>>>(
      ENDPOINTS.airflow.dagRunGantt(dagId, runId),
    );
    return res.data.data;
  },

  getHealth: async (): Promise<unknown> => {
    const res = await apiClient.get<ApiResponse<unknown>>(ENDPOINTS.airflow.health);
    return res.data.data;
  },

  getStats: async (): Promise<AirflowStats> => {
    const res = await apiClient.get<ApiResponse<AirflowStats>>(ENDPOINTS.airflow.stats);
    return res.data.data;
  },
};
