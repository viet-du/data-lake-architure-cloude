import { useMutation, useQuery, useQueryClient, type UseMutationOptions, type UseQueryOptions } from '@tanstack/react-query';
import { silverService, type ListSilverTablesParams, type TransformAllPayload, type TransformPayload } from '../silver';
import { QUERY_KEYS } from '../query-keys';
import type {
  SilverJobsStats,
  SilverTable,
  SilverTableDiff,
  SilverTableHistory,
  SilverTableSample,
  SilverTableStats,
  SilverTimeTravel,
  SilverTransformJob,
} from '@/types/entities';

export function useSilverTablesQuery(
  params?: ListSilverTablesParams,
  options?: Omit<UseQueryOptions<unknown, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<unknown, Error>({
    queryKey: QUERY_KEYS.silver.tables(params),
    queryFn: () => silverService.listTables(params),
    ...options,
  });
}

export function useSilverTableQuery(
  table: string,
  options?: Omit<UseQueryOptions<SilverTable, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<SilverTable, Error>({
    queryKey: QUERY_KEYS.silver.table(table),
    queryFn: () => silverService.getTable(table),
    enabled: table.length > 0,
    ...options,
  });
}

export function useSilverTableSampleQuery(
  table: string,
  limit?: number,
  options?: Omit<UseQueryOptions<SilverTableSample, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<SilverTableSample, Error>({
    queryKey: [...QUERY_KEYS.silver.tableSample(table), limit ?? 100],
    queryFn: () => silverService.getTableSample(table, limit),
    enabled: table.length > 0,
    ...options,
  });
}

export function useSilverTableStatsQuery(
  table: string,
  options?: Omit<UseQueryOptions<SilverTableStats, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<SilverTableStats, Error>({
    queryKey: QUERY_KEYS.silver.tableStats(table),
    queryFn: () => silverService.getTableStats(table),
    enabled: table.length > 0,
    ...options,
  });
}

export function useSilverTableHistoryQuery(
  table: string,
  options?: Omit<UseQueryOptions<ReadonlyArray<SilverTableHistory>, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<ReadonlyArray<SilverTableHistory>, Error>({
    queryKey: QUERY_KEYS.silver.tableHistory(table),
    queryFn: () => silverService.getTableHistory(table),
    enabled: table.length > 0,
    ...options,
  });
}

export function useSilverTimeTravelQuery(
  table: string,
  version: string,
  options?: Omit<UseQueryOptions<SilverTimeTravel, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<SilverTimeTravel, Error>({
    queryKey: QUERY_KEYS.silver.timeTravel(table, version),
    queryFn: () => silverService.getTimeTravel(table, version),
    enabled: table.length > 0 && version.length > 0,
    ...options,
  });
}

export function useSilverTableDiffQuery(
  table: string,
  v1: string,
  v2: string,
  options?: Omit<UseQueryOptions<SilverTableDiff, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<SilverTableDiff, Error>({
    queryKey: QUERY_KEYS.silver.diff(table, v1, v2),
    queryFn: () => silverService.getTableDiff(table, v1, v2),
    enabled: table.length > 0 && v1.length > 0 && v2.length > 0,
    ...options,
  });
}

export function useSilverJobsQuery(
  options?: Omit<UseQueryOptions<ReadonlyArray<SilverTransformJob>, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<ReadonlyArray<SilverTransformJob>, Error>({
    queryKey: QUERY_KEYS.silver.jobs(),
    queryFn: () => silverService.listJobs(),
    ...options,
  });
}

export function useSilverJobStatsQuery(
  options?: Omit<UseQueryOptions<SilverJobsStats, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<SilverJobsStats, Error>({
    queryKey: QUERY_KEYS.silver.jobsStats(),
    queryFn: () => silverService.getJobStats(),
    ...options,
  });
}

export function useSilverJobQuery(
  jobId: string,
  options?: Omit<UseQueryOptions<SilverTransformJob, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<SilverTransformJob, Error>({
    queryKey: QUERY_KEYS.silver.job(jobId),
    queryFn: () => silverService.getJob(jobId),
    enabled: jobId.length > 0,
    ...options,
  });
}

export function useRefreshSilverMutation(
  options?: UseMutationOptions<SilverTransformJob, Error, string>,
) {
  const qc = useQueryClient();
  return useMutation<SilverTransformJob, Error, string>({
    mutationFn: (table) => silverService.refresh(table),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.silver.all });
    },
    ...options,
  });
}

export function useTransformMutation(
  options?: UseMutationOptions<SilverTransformJob, Error, { table: string; payload: TransformPayload }>,
) {
  const qc = useQueryClient();
  return useMutation<SilverTransformJob, Error, { table: string; payload: TransformPayload }>({
    mutationFn: ({ table, payload }) => silverService.transform(table, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.silver.all });
    },
    ...options,
  });
}

export function useTransformAllMutation(
  options?: UseMutationOptions<ReadonlyArray<SilverTransformJob>, Error, TransformAllPayload>,
) {
  const qc = useQueryClient();
  return useMutation<ReadonlyArray<SilverTransformJob>, Error, TransformAllPayload>({
    mutationFn: (payload) => silverService.transformAll(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.silver.all });
    },
    ...options,
  });
}

export function useCancelSilverJobMutation(
  options?: UseMutationOptions<void, Error, string>,
) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (jobId) => silverService.cancelJob(jobId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.silver.jobs() });
    },
    ...options,
  });
}
