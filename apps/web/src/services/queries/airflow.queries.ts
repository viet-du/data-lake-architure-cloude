import { useMutation, useQuery, useQueryClient, type UseMutationOptions, type UseQueryOptions } from '@tanstack/react-query';
import { airflowService, type ListDAGRunsParams, type TriggerDAGPayload } from '../airflow';
import { QUERY_KEYS } from '../query-keys';
import type {
  AirflowDAG,
  AirflowDAGRun,
  AirflowGanttEntry,
  AirflowStats,
  AirflowTaskInstance,
  AirflowTaskLogs,
  AirflowTriggerResult,
} from '@/types/entities';

export function useDAGsQuery(
  options?: Omit<UseQueryOptions<ReadonlyArray<AirflowDAG>, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<ReadonlyArray<AirflowDAG>, Error>({
    queryKey: QUERY_KEYS.airflow.dags(),
    queryFn: () => airflowService.listDAGs(),
    ...options,
  });
}

export function useDAGQuery(
  dagId: string,
  options?: Omit<UseQueryOptions<AirflowDAG, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<AirflowDAG, Error>({
    queryKey: QUERY_KEYS.airflow.dag(dagId),
    queryFn: () => airflowService.getDAG(dagId),
    enabled: dagId.length > 0,
    ...options,
  });
}

export function useDAGRunsQuery(
  dagId: string,
  params?: ListDAGRunsParams,
  options?: Omit<UseQueryOptions<ReadonlyArray<AirflowDAGRun>, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<ReadonlyArray<AirflowDAGRun>, Error>({
    queryKey: [...QUERY_KEYS.airflow.dagRuns(dagId), params ?? {}],
    queryFn: () => airflowService.listDAGRuns(dagId, params),
    enabled: dagId.length > 0,
    ...options,
  });
}

export function useDAGRunQuery(
  dagId: string,
  runId: string,
  options?: Omit<UseQueryOptions<AirflowDAGRun, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<AirflowDAGRun, Error>({
    queryKey: QUERY_KEYS.airflow.dagRun(dagId, runId),
    queryFn: () => airflowService.getDAGRun(dagId, runId),
    enabled: dagId.length > 0 && runId.length > 0,
    ...options,
  });
}

export function useDAGRunTasksQuery(
  dagId: string,
  runId: string,
  options?: Omit<UseQueryOptions<ReadonlyArray<AirflowTaskInstance>, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<ReadonlyArray<AirflowTaskInstance>, Error>({
    queryKey: QUERY_KEYS.airflow.dagRunTasks(dagId, runId),
    queryFn: () => airflowService.listDAGRunTasks(dagId, runId),
    enabled: dagId.length > 0 && runId.length > 0,
    ...options,
  });
}

export function useTaskLogsQuery(
  dagId: string,
  runId: string,
  taskId: string,
  tryNumber?: number,
  options?: Omit<UseQueryOptions<AirflowTaskLogs, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<AirflowTaskLogs, Error>({
    queryKey: [...QUERY_KEYS.airflow.dagRun(dagId, runId), 'task', taskId, 'logs', tryNumber ?? 1],
    queryFn: () => airflowService.getTaskLogs(dagId, runId, taskId, tryNumber),
    enabled: dagId.length > 0 && runId.length > 0 && taskId.length > 0,
    ...options,
  });
}

export function useDAGRunGanttQuery(
  dagId: string,
  runId: string,
  options?: Omit<UseQueryOptions<ReadonlyArray<AirflowGanttEntry>, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<ReadonlyArray<AirflowGanttEntry>, Error>({
    queryKey: QUERY_KEYS.airflow.dagRunGantt(dagId, runId),
    queryFn: () => airflowService.getDAGRunGantt(dagId, runId),
    enabled: dagId.length > 0 && runId.length > 0,
    ...options,
  });
}

export function useAirflowStatsQuery(
  options?: Omit<UseQueryOptions<AirflowStats, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<AirflowStats, Error>({
    queryKey: QUERY_KEYS.airflow.stats(),
    queryFn: () => airflowService.getStats(),
    ...options,
  });
}

export function useTriggerDAGMutation(
  options?: UseMutationOptions<AirflowTriggerResult, Error, { dagId: string; payload?: TriggerDAGPayload }>,
) {
  const qc = useQueryClient();
  return useMutation<AirflowTriggerResult, Error, { dagId: string; payload?: TriggerDAGPayload }>({
    mutationFn: ({ dagId, payload }) => airflowService.triggerDAG(dagId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.airflow.all });
    },
    ...options,
  });
}

export function usePauseDAGMutation(
  options?: UseMutationOptions<void, Error, string>,
) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (dagId) => airflowService.pauseDAG(dagId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.airflow.all });
    },
    ...options,
  });
}

export function useUnpauseDAGMutation(
  options?: UseMutationOptions<void, Error, string>,
) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (dagId) => airflowService.unpauseDAG(dagId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.airflow.all });
    },
    ...options,
  });
}

export function useDeleteDAGRunMutation(
  options?: UseMutationOptions<void, Error, { dagId: string; runId: string }>,
) {
  const qc = useQueryClient();
  return useMutation<void, Error, { dagId: string; runId: string }>({
    mutationFn: ({ dagId, runId }) => airflowService.deleteDAGRun(dagId, runId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.airflow.all });
    },
    ...options,
  });
}
