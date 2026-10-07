import { AirflowClientSingleton } from './airflow-client';
import type {
  Dag,
  DagDetail,
  DagRun,
  DagTask,
  TaskInstance,
  GanttTask,
  AirflowHealth,
  AirflowStats,
  DagRunState,
} from '../types';

interface AirflowListResponse<T> {
  dags?: T[];
  dag_runs?: T[];
  task_instances?: T[];
  total_entries?: number;
}

interface AirflowDagSummary {
  dag_id: string;
  description: string | null;
  schedule_interval: { value: string; text: string } | string | null;
  is_active: boolean;
  is_paused: boolean;
  tags: Array<{ name: string }>;
  owners: string[];
  file_token: string;
  last_parsed_time: string | null;
}

interface AirflowTaskSummary {
  task_id: string;
  operator_name?: string;
  downstream_task_ids: string[];
  doc_md: string | null;
  retries: number;
  retry_delay: number;
  pool: string;
}

interface AirflowDagDetailResponse extends AirflowDagSummary {
  params: Record<string, unknown> | string;
  catchup: boolean;
  start_date: string | null;
  end_date: string | null;
  max_active_runs: number;
  max_active_tasks: number;
  default_args: Record<string, unknown> | string;
  tasks: AirflowTaskSummary[];
}

interface AirflowDagRun {
  run_id: string;
  dag_id: string;
  logical_date: string;
  execution_date?: string;
  state: DagRunState;
  run_type: string;
  queued_at: string | null;
  start_date: string | null;
  end_date: string | null;
  external_trigger: boolean;
  conf: Record<string, unknown> | string;
}

interface AirflowTaskInstance {
  task_id: string;
  dag_id: string;
  run_id: string;
  state: string;
  try_number: number;
  max_tries: number;
  queued_when: string | null;
  start_date: string | null;
  end_date: string | null;
  duration: number | null;
  log_url: string | null;
  operator: string;
  hostname: string | null;
  pool: string;
  pool_slots: number;
}

function parseConf(conf: Record<string, unknown> | string): Record<string, unknown> {
  if (typeof conf === 'string') {
    try {
      return JSON.parse(conf) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return conf ?? {};
}

function parseSchedule(value: AirflowDagSummary['schedule_interval']): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  return value.text ?? value.value ?? null;
}

function toDag(d: AirflowDagSummary): Dag {
  return {
    dagId: d.dag_id,
    description: d.description,
    scheduleInterval: parseSchedule(d.schedule_interval),
    isActive: d.is_active,
    isPaused: d.is_paused,
    tags: (d.tags ?? []).map((t) => t.name),
    owners: d.owners ?? [],
    fileToken: d.file_token,
    lastParsedTime: d.last_parsed_time,
  };
}

function toDagTask(t: AirflowTaskSummary): DagTask {
  return {
    taskId: t.task_id,
    operator: t.operator_name ?? t.task_id,
    downstreamTaskIds: t.downstream_task_ids ?? [],
    docMd: t.doc_md,
    retries: t.retries,
    retryDelaySeconds: t.retry_delay,
    pool: t.pool,
  };
}

function toDagDetail(d: AirflowDagDetailResponse): DagDetail {
  return {
    ...toDag(d),
    tasks: (d.tasks ?? []).map(toDagTask),
    params:
      typeof d.params === 'string'
        ? (() => {
            try {
              return JSON.parse(d.params) as Record<string, unknown>;
            } catch {
              return {};
            }
          })()
        : (d.params ?? {}),
    catchup: d.catchup,
    startDate: d.start_date,
    endDate: d.end_date,
    maxActiveRuns: d.max_active_runs,
    maxActiveTasks: d.max_active_tasks,
    defaultArgs:
      typeof d.default_args === 'string'
        ? (() => {
            try {
              return JSON.parse(d.default_args) as Record<string, unknown>;
            } catch {
              return {};
            }
          })()
        : (d.default_args ?? {}),
  };
}

function toDagRun(r: AirflowDagRun): DagRun {
  return {
    runId: r.run_id,
    dagId: r.dag_id,
    executionDate: r.logical_date ?? r.execution_date ?? '',
    state: r.state,
    runType: r.run_type,
    queuedAt: r.queued_at,
    startDate: r.start_date,
    endDate: r.end_date,
    externalTrigger: r.external_trigger,
    conf: parseConf(r.conf),
  };
}

function toTaskInstance(t: AirflowTaskInstance): TaskInstance {
  return {
    taskId: t.task_id,
    dagId: t.dag_id,
    runId: t.run_id,
    state: t.state as TaskInstance['state'],
    tryNumber: t.try_number,
    maxTries: t.max_tries,
    queuedWhen: t.queued_when,
    startDate: t.start_date,
    endDate: t.end_date,
    duration: t.duration,
    logUrl: t.log_url,
    operator: t.operator,
    hostname: t.hostname,
    pool: t.pool,
    poolSlots: t.pool_slots,
  };
}

function toGantt(t: AirflowTaskInstance): GanttTask {
  return {
    taskId: t.task_id,
    startDate: t.start_date,
    endDate: t.end_date,
    duration: t.duration,
    state: t.state as TaskInstance['state'],
    operator: t.operator,
  };
}

export const AirflowDagRepository = {
  async list(opts: {
    limit: number;
    offset: number;
    onlyActive: boolean;
    paused?: boolean;
    tags?: string;
    pattern?: string;
  }): Promise<{ total: number; items: Dag[] }> {
    const client = AirflowClientSingleton.get();
    const query: Record<string, string | number | boolean> = {
      limit: opts.limit,
      offset: opts.offset,
    };
    if (opts.onlyActive) query.only_active = 'true';
    if (opts.paused !== undefined) query.paused = String(opts.paused);
    if (opts.tags) query.tags = opts.tags;
    const res = await client.request<AirflowListResponse<AirflowDagSummary>>({
      method: 'GET',
      path: '/dags',
      query,
    });
    const allDags = (res.dags ?? []).map(toDag);
    const filtered = opts.pattern
      ? allDags.filter((d) => new RegExp(opts.pattern as string).test(d.dagId))
      : allDags;
    return { total: res.total_entries ?? filtered.length, items: filtered };
  },

  async detail(dagId: string): Promise<DagDetail> {
    const client = AirflowClientSingleton.get();
    const res = await client.request<AirflowDagDetailResponse>({
      method: 'GET',
      path: `/dags/${encodeURIComponent(dagId)}`,
    });
    return toDagDetail(res);
  },

  async pause(dagId: string): Promise<{ dagId: string; isPaused: boolean }> {
    const client = AirflowClientSingleton.get();
    await client.request<unknown>({
      method: 'PATCH',
      path: `/dags/${encodeURIComponent(dagId)}`,
      body: { is_paused: true },
    });
    return { dagId, isPaused: true };
  },

  async unpause(dagId: string): Promise<{ dagId: string; isPaused: boolean }> {
    const client = AirflowClientSingleton.get();
    await client.request<unknown>({
      method: 'PATCH',
      path: `/dags/${encodeURIComponent(dagId)}`,
      body: { is_paused: false },
    });
    return { dagId, isPaused: false };
  },
};

export const AirflowRunRepository = {
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
    const client = AirflowClientSingleton.get();
    const params: Record<string, string | number> = {
      limit: query.limit,
      offset: query.offset,
      order_by: query.orderBy,
    };
    if (query.state) params.state = query.state;
    if (query.startDateGte) params.start_date_gte = query.startDateGte;
    if (query.startDateLte) params.start_date_lte = query.startDateLte;
    const res = await client.request<AirflowListResponse<AirflowDagRun>>({
      method: 'GET',
      path: `/dags/${encodeURIComponent(dagId)}/dagRuns`,
      query: params,
    });
    const items = (res.dag_runs ?? []).map(toDagRun);
    return { total: res.total_entries ?? items.length, items };
  },

  async trigger(
    dagId: string,
    body: { conf: Record<string, unknown>; note?: string; logicalDate?: string; runId?: string },
  ): Promise<DagRun> {
    const client = AirflowClientSingleton.get();
    const payload: Record<string, unknown> = { conf: body.conf };
    if (body.note) payload.note = body.note;
    if (body.logicalDate) payload.logical_date = body.logicalDate;
    if (body.runId) payload.run_id = body.runId;
    const res = await client.request<AirflowDagRun>({
      method: 'POST',
      path: `/dags/${encodeURIComponent(dagId)}/dagRuns`,
      body: payload,
    });
    return toDagRun(res);
  },

  async detail(dagId: string, runId: string): Promise<DagRun> {
    const client = AirflowClientSingleton.get();
    const res = await client.request<AirflowDagRun>({
      method: 'GET',
      path: `/dags/${encodeURIComponent(dagId)}/dagRuns/${encodeURIComponent(runId)}`,
    });
    return toDagRun(res);
  },

  async delete(dagId: string, runId: string): Promise<{ dagId: string; runId: string; deleted: boolean }> {
    const client = AirflowClientSingleton.get();
    await client.request<unknown>({
      method: 'DELETE',
      path: `/dags/${encodeURIComponent(dagId)}/dagRuns/${encodeURIComponent(runId)}`,
    });
    return { dagId, runId, deleted: true };
  },
};

export const AirflowTaskRepository = {
  async list(
    dagId: string,
    runId: string,
    query: { state?: TaskInstance['state'] },
  ): Promise<{ total: number; items: TaskInstance[] }> {
    const client = AirflowClientSingleton.get();
    const params: Record<string, string | number> = { limit: 200, offset: 0 };
    if (query.state) params.state = query.state;
    const res = await client.request<AirflowListResponse<AirflowTaskInstance>>({
      method: 'GET',
      path: `/dags/${encodeURIComponent(dagId)}/dagRuns/${encodeURIComponent(runId)}/taskInstances`,
      query: params,
    });
    const items = (res.task_instances ?? []).map(toTaskInstance);
    return { total: res.total_entries ?? items.length, items };
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
    const client = AirflowClientSingleton.get();
    const params: Record<string, string | number | boolean> = {
      try_number: query.tryNumber,
      full_content: query.fullContent,
      map_index: query.mapIndex,
    };
    const res = await client.request<{ content: string; continuation_token: string | null }>({
      method: 'GET',
      path: `/dags/${encodeURIComponent(dagId)}/dagRuns/${encodeURIComponent(runId)}/taskInstances/${encodeURIComponent(taskId)}/logs/${query.tryNumber}`,
      query: params,
    });
    return {
      taskId,
      dagId,
      runId,
      tryNumber: query.tryNumber,
      content: res.content ?? '',
      contentUrl: null,
    };
  },

  async gantt(dagId: string, runId: string): Promise<{
    dagId: string;
    runId: string;
    tasks: GanttTask[];
  }> {
    const client = AirflowClientSingleton.get();
    const res = await client.request<AirflowListResponse<AirflowTaskInstance>>({
      method: 'GET',
      path: `/dags/${encodeURIComponent(dagId)}/dagRuns/${encodeURIComponent(runId)}/taskInstances`,
      query: { limit: 500, offset: 0 },
    });
    return {
      dagId,
      runId,
      tasks: (res.task_instances ?? []).map(toGantt),
    };
  },
};

export const AirflowClusterRepository = {
  async health(): Promise<AirflowHealth> {
    const client = AirflowClientSingleton.get();
    return client.request<AirflowHealth>({ method: 'GET', path: '/health' });
  },

  async stats(): Promise<AirflowStats> {
    const client = AirflowClientSingleton.get();
    const [dagsRes, runsRes] = await Promise.all([
      client.request<AirflowListResponse<AirflowDagSummary>>({
        method: 'GET',
        path: '/dags',
        query: { limit: 1000, offset: 0 },
      }),
      client.request<{ dags_run_states?: Array<{ dag_id: string; run_states: Record<string, number> }> }>({
        method: 'GET',
        path: '/dag_runs/statistics',
        query: { limit: 1000, offset: 0 },
      }).catch(() => ({ dags_run_states: [] })),
    ]);
    const dags = (dagsRes.dags ?? []).map(toDag);
    const totalDags = dags.length;
    const activeDags = dags.filter((d) => d.isActive && !d.isPaused).length;
    const pausedDags = dags.filter((d) => d.isPaused).length;
    const byState: Record<string, number> = {};
    let runningRuns = 0;
    let failedRuns = 0;
    let successRuns = 0;
    let queuedRuns = 0;
    for (const ds of runsRes.dags_run_states ?? []) {
      for (const [state, count] of Object.entries(ds.run_states ?? {})) {
        byState[state] = (byState[state] ?? 0) + count;
        if (state === 'running') runningRuns += count;
        else if (state === 'failed') failedRuns += count;
        else if (state === 'success') successRuns += count;
        else if (state === 'queued') queuedRuns += count;
      }
    }
    return {
      totalDags,
      activeDags,
      pausedDags,
      runningRuns,
      failedRuns,
      successRuns,
      queuedRuns,
      byDate: [],
      byState: Object.entries(byState).map(([state, count]) => ({
        state: state as DagRunState,
        count,
      })),
    };
  },
};