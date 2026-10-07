import {
  AirflowDagService,
  AirflowRunService,
} from '../services/airflow.service';
import type { Dag, DagDetail, DagRun } from '../types';
import type {
  TDagIdParam,
  TDagListQuery,
  TTriggerDagBody,
  TRunIdParam,
  TRunsListQuery,
} from '../schemas';

export const AirflowDagController = {
  async list(query: TDagListQuery): Promise<{ total: number; items: Dag[] }> {
    return AirflowDagService.list({
      limit: query.limit,
      offset: query.offset,
      onlyActive: query.onlyActive,
      ...(query.paused !== undefined ? { paused: query.paused } : {}),
      ...(query.tags !== undefined ? { tags: query.tags } : {}),
      ...(query.pattern !== undefined ? { pattern: query.pattern } : {}),
    });
  },

  async detail(params: TDagIdParam): Promise<DagDetail> {
    return AirflowDagService.detail(params.dagId);
  },

  async trigger(params: TDagIdParam, body: TTriggerDagBody): Promise<DagRun> {
    return AirflowDagService.trigger(params.dagId, {
      conf: body.conf,
      ...(body.note !== undefined ? { note: body.note } : {}),
      ...(body.logicalDate !== undefined ? { logicalDate: body.logicalDate } : {}),
      ...(body.runId !== undefined ? { runId: body.runId } : {}),
    });
  },

  async pause(params: TDagIdParam): Promise<{ dagId: string; isPaused: boolean }> {
    return AirflowDagService.pause(params.dagId);
  },

  async unpause(params: TDagIdParam): Promise<{ dagId: string; isPaused: boolean }> {
    return AirflowDagService.unpause(params.dagId);
  },

  async listRuns(
    params: TDagIdParam,
    query: TRunsListQuery,
  ): Promise<{ total: number; items: DagRun[] }> {
    return AirflowRunService.list(params.dagId, {
      limit: query.limit,
      offset: query.offset,
      orderBy: query.orderBy,
      ...(query.state !== undefined ? { state: query.state } : {}),
      ...(query.startDateGte !== undefined ? { startDateGte: query.startDateGte } : {}),
      ...(query.startDateLte !== undefined ? { startDateLte: query.startDateLte } : {}),
    });
  },

  async getRun(params: TRunIdParam): Promise<DagRun> {
    return AirflowRunService.detail(params.dagId, params.runId);
  },

  async deleteRun(params: TRunIdParam): Promise<{ dagId: string; runId: string; deleted: boolean }> {
    return AirflowRunService.remove(params.dagId, params.runId);
  },
};