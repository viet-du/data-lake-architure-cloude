import {
  AirflowDagRepository,
  AirflowRunRepository,
  AirflowTaskRepository,
  AirflowClusterRepository,
  AirflowClientSingleton,
} from '../repositories';
import { filterConf, validateConfValues } from '../types/dag-conf';
import { evaluatePreflight, describeConfSpec } from './preflight.service';
import type {
  Dag,
  DagDetail,
  DagRun,
  TaskInstance,
  GanttTask,
  AirflowHealth,
  AirflowStats,
  DagRunState,
  PreflightResult,
} from '../types';
import { AppError } from '@/errors';

export const AirflowDagService = {
  async list(opts: {
    limit: number;
    offset: number;
    onlyActive: boolean;
    paused?: boolean;
    tags?: string;
    pattern?: string;
  }): Promise<{ total: number; items: Dag[] }> {
    return AirflowDagRepository.list(opts);
  },

  async detail(dagId: string): Promise<DagDetail> {
    try {
      return await AirflowDagRepository.detail(dagId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('-> 404') || msg.toLowerCase().includes('not found')) {
        throw new AppError(404, 'DAG_NOT_FOUND', `DAG not found: ${dagId}`);
      }
      throw err;
    }
  },

  async trigger(
    dagId: string,
    body: { conf: Record<string, unknown>; note?: string; logicalDate?: string; runId?: string },
  ): Promise<DagRun> {
    // The conf allowlist is enforced *before* the run is created. A rejected
    // key is an error the operator must see: silently dropping a field the
    // user typed would produce a run that quietly did something else.
    const { rejected } = filterConf(dagId, body.conf);
    if (rejected.length > 0) {
      throw new AppError(
        400,
        'CONF_KEY_NOT_ALLOWED',
        `These conf keys are not allowed for "${dagId}": ${rejected.join(', ')}.`,
      );
    }
    const { errors } = validateConfValues(dagId, body.conf);
    if (errors.length > 0) {
      throw new AppError(400, 'INVALID_CONF_VALUE', errors.join(' '));
    }

    try {
      return await AirflowRunRepository.trigger(dagId, {
        conf: body.conf,
        ...(body.note !== undefined ? { note: body.note } : {}),
        ...(body.logicalDate !== undefined ? { logicalDate: body.logicalDate } : {}),
        ...(body.runId !== undefined ? { runId: body.runId } : {}),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('-> 404')) {
        throw new AppError(404, 'DAG_NOT_FOUND', `DAG not found: ${dagId}`);
      }
      if (msg.includes('-> 400')) {
        throw new AppError(400, 'INVALID_TRIGGER', msg);
      }
      throw err;
    }
  },

  /**
   * Evaluate the preflight for a DAG.
   *
   * Read-only: nothing is triggered, paused or otherwise mutated.
   */
  async preflight(dagId: string, conf: Record<string, unknown> = {}): Promise<PreflightResult> {
    return evaluatePreflight(dagId, conf);
  },

  /**
   * The typed conf specification for a DAG.
   *
   * The wizard renders a form from this; it never asks the operator to type
   * raw JSON.
   */
  async confSpec(dagId: string): Promise<ReturnType<typeof describeConfSpec>> {
    // A DAG that does not exist must not advertise a conf spec: the wizard
    // would then offer fields for a DAG that cannot run.
    try {
      await AirflowDagRepository.detail(dagId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('-> 404')) {
        throw new AppError(404, 'DAG_NOT_FOUND', `DAG not found: ${dagId}`);
      }
      throw err;
    }
    return describeConfSpec(dagId);
  },

  async pause(dagId: string): Promise<{ dagId: string; isPaused: boolean }> {
    try {
      return await AirflowDagRepository.pause(dagId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('-> 404')) {
        throw new AppError(404, 'DAG_NOT_FOUND', `DAG not found: ${dagId}`);
      }
      throw err;
    }
  },

  async unpause(dagId: string): Promise<{ dagId: string; isPaused: boolean }> {
    try {
      return await AirflowDagRepository.unpause(dagId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('-> 404')) {
        throw new AppError(404, 'DAG_NOT_FOUND', `DAG not found: ${dagId}`);
      }
      throw err;
    }
  },
};

export const AirflowRunService = {
  async list(
    dagId: string,
    query: {
      state?: DagRunState;
      limit: number;
      offset: number;
      startDateGte?: string;
      startDateLte?: string;
      orderBy: string;
    },
  ): Promise<{ total: number; items: DagRun[] }> {
    try {
      return await AirflowRunRepository.list(dagId, query);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('-> 404')) {
        throw new AppError(404, 'DAG_NOT_FOUND', `DAG not found: ${dagId}`);
      }
      throw err;
    }
  },

  async detail(dagId: string, runId: string): Promise<DagRun> {
    try {
      return await AirflowRunRepository.detail(dagId, runId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('-> 404')) {
        throw new AppError(404, 'RUN_NOT_FOUND', `DAG run not found: ${dagId}/${runId}`);
      }
      throw err;
    }
  },

  async remove(dagId: string, runId: string): Promise<{ dagId: string; runId: string; deleted: boolean }> {
    try {
      return await AirflowRunRepository.delete(dagId, runId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('-> 404')) {
        throw new AppError(404, 'RUN_NOT_FOUND', `DAG run not found: ${dagId}/${runId}`);
      }
      throw err;
    }
  },
};

export const AirflowTaskService = {
  async list(
    dagId: string,
    runId: string,
    query: { state?: TaskInstance['state'] },
  ): Promise<{ total: number; items: TaskInstance[] }> {
    return AirflowTaskRepository.list(dagId, runId, query);
  },

  async logs(
    dagId: string,
    runId: string,
    taskId: string,
    query: { tryNumber: number; fullContent: boolean; mapIndex: number },
  ): Promise<{
    taskId: string;
    dagId: string;
    runId: string;
    tryNumber: number;
    content: string;
    contentUrl: string | null;
  }> {
    try {
      return await AirflowTaskRepository.logs(dagId, runId, taskId, query);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('-> 404')) {
        throw new AppError(404, 'TASK_NOT_FOUND', `Task not found: ${dagId}/${runId}/${taskId}`);
      }
      throw err;
    }
  },

  async gantt(dagId: string, runId: string): Promise<{
    dagId: string;
    runId: string;
    tasks: GanttTask[];
  }> {
    return AirflowTaskRepository.gantt(dagId, runId);
  },
};

export const AirflowClusterService = {
  async health(): Promise<{ config: { baseUrl: string; hasAuth: boolean; timeoutMs: number }; health: AirflowHealth | null; reachable: boolean }> {
    const config = AirflowClientSingleton.get().getConfig();
    try {
      const health = await AirflowClusterRepository.health();
      return { config, health, reachable: true };
    } catch {
      return { config, health: null, reachable: false };
    }
  },

  async stats(): Promise<AirflowStats> {
    try {
      return await AirflowClusterRepository.stats();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new AppError(503, 'AIRFLOW_UNREACHABLE', `Airflow unreachable: ${msg}`);
    }
  },
};