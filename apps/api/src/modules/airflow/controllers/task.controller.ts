import {
  AirflowTaskService,
  AirflowClusterService,
} from '../services/airflow.service';
import type { TaskInstance, GanttTask, AirflowHealth, AirflowStats } from '../types';
import type {
  TRunIdParam,
  TTaskIdParam,
  TTaskLogQuery,
  TTaskListQuery,
} from '../schemas';

export const AirflowTaskController = {
  async list(
    params: TRunIdParam,
    query: TTaskListQuery,
  ): Promise<{ total: number; items: TaskInstance[] }> {
    return AirflowTaskService.list(params.dagId, params.runId, {
      ...(query.state !== undefined ? { state: query.state } : {}),
    });
  },

  async logs(
    params: TTaskIdParam,
    query: TTaskLogQuery,
  ): Promise<{
    taskId: string;
    dagId: string;
    runId: string;
    tryNumber: number;
    content: string;
    contentUrl: string | null;
  }> {
    return AirflowTaskService.logs(params.dagId, params.runId, params.taskId, {
      tryNumber: query.tryNumber,
      fullContent: query.fullContent,
      mapIndex: query.mapIndex,
    });
  },

  async gantt(params: TRunIdParam): Promise<{ dagId: string; runId: string; tasks: GanttTask[] }> {
    return AirflowTaskService.gantt(params.dagId, params.runId);
  },
};

export const AirflowClusterController = {
  async health(): Promise<{ config: { baseUrl: string; hasAuth: boolean; timeoutMs: number }; health: AirflowHealth | null; reachable: boolean }> {
    return AirflowClusterService.health();
  },

  async stats(): Promise<AirflowStats> {
    return AirflowClusterService.stats();
  },
};