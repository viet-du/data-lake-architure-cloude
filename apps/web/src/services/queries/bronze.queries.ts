import { useMutation, useQuery, useQueryClient, type UseMutationOptions, type UseQueryOptions } from '@tanstack/react-query';
import { bronzeService, type IngestCsvPayload, type IngestJsonPayload, type IngestStreamPayload, type ListBronzeTablesParams, type VacuumPayload } from '../bronze';
import { QUERY_KEYS } from '../query-keys';
import type {
  BronzeIngestJob,
  BronzeJobsStats,
  BronzeTable,
  BronzeTableHistory,
  BronzeTablePartition,
  BronzeTableSample,
  BronzeTableStats,
} from '@/types/entities';

export function useBronzeTablesQuery(
  params?: ListBronzeTablesParams,
  options?: Omit<UseQueryOptions<unknown, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<unknown, Error>({
    queryKey: QUERY_KEYS.bronze.tables(params),
    queryFn: () => bronzeService.listTables(params),
    ...options,
  });
}

export function useBronzeTableQuery(
  table: string,
  options?: Omit<UseQueryOptions<BronzeTable, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<BronzeTable, Error>({
    queryKey: QUERY_KEYS.bronze.table(table),
    queryFn: () => bronzeService.getTable(table),
    enabled: table.length > 0,
    ...options,
  });
}

export function useBronzeTableSampleQuery(
  table: string,
  limit?: number,
  options?: Omit<UseQueryOptions<BronzeTableSample, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<BronzeTableSample, Error>({
    queryKey: [...QUERY_KEYS.bronze.tableSample(table), limit ?? 100],
    queryFn: () => bronzeService.getTableSample(table, limit),
    enabled: table.length > 0,
    ...options,
  });
}

export function useBronzeTableStatsQuery(
  table: string,
  options?: Omit<UseQueryOptions<BronzeTableStats, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<BronzeTableStats, Error>({
    queryKey: QUERY_KEYS.bronze.tableStats(table),
    queryFn: () => bronzeService.getTableStats(table),
    enabled: table.length > 0,
    ...options,
  });
}

export function useBronzeTableHistoryQuery(
  table: string,
  options?: Omit<UseQueryOptions<ReadonlyArray<BronzeTableHistory>, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<ReadonlyArray<BronzeTableHistory>, Error>({
    queryKey: QUERY_KEYS.bronze.tableHistory(table),
    queryFn: () => bronzeService.getTableHistory(table),
    enabled: table.length > 0,
    ...options,
  });
}

export function useBronzeTablePartitionsQuery(
  table: string,
  options?: Omit<UseQueryOptions<ReadonlyArray<BronzeTablePartition>, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<ReadonlyArray<BronzeTablePartition>, Error>({
    queryKey: QUERY_KEYS.bronze.tablePartitions(table),
    queryFn: () => bronzeService.getTablePartitions(table),
    enabled: table.length > 0,
    ...options,
  });
}

export function useBronzeJobsQuery(
  options?: Omit<UseQueryOptions<ReadonlyArray<BronzeIngestJob>, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<ReadonlyArray<BronzeIngestJob>, Error>({
    queryKey: QUERY_KEYS.bronze.jobs(),
    queryFn: () => bronzeService.listJobs(),
    ...options,
  });
}

export function useBronzeJobStatsQuery(
  options?: Omit<UseQueryOptions<BronzeJobsStats, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<BronzeJobsStats, Error>({
    queryKey: QUERY_KEYS.bronze.jobsStats(),
    queryFn: () => bronzeService.getJobStats(),
    ...options,
  });
}

export function useBronzeJobQuery(
  jobId: string,
  options?: Omit<UseQueryOptions<BronzeIngestJob, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<BronzeIngestJob, Error>({
    queryKey: QUERY_KEYS.bronze.job(jobId),
    queryFn: () => bronzeService.getJob(jobId),
    enabled: jobId.length > 0,
    ...options,
  });
}

export function useIngestJsonMutation(
  options?: UseMutationOptions<BronzeIngestJob, Error, IngestJsonPayload>,
) {
  const qc = useQueryClient();
  return useMutation<BronzeIngestJob, Error, IngestJsonPayload>({
    mutationFn: (payload) => bronzeService.ingestJson(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.bronze.all });
    },
    ...options,
  });
}

export function useIngestCsvMutation(
  options?: UseMutationOptions<BronzeIngestJob, Error, IngestCsvPayload>,
) {
  const qc = useQueryClient();
  return useMutation<BronzeIngestJob, Error, IngestCsvPayload>({
    mutationFn: (payload) => bronzeService.ingestCsv(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.bronze.all });
    },
    ...options,
  });
}

export function useIngestStreamMutation(
  options?: UseMutationOptions<BronzeIngestJob, Error, { topic: string; payload: IngestStreamPayload }>,
) {
  const qc = useQueryClient();
  return useMutation<BronzeIngestJob, Error, { topic: string; payload: IngestStreamPayload }>({
    mutationFn: ({ topic, payload }) => bronzeService.ingestStream(topic, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.bronze.all });
    },
    ...options,
  });
}

export function useVacuumMutation(
  options?: UseMutationOptions<unknown, Error, { table: string; payload: VacuumPayload }>,
) {
  const qc = useQueryClient();
  return useMutation<unknown, Error, { table: string; payload: VacuumPayload }>({
    mutationFn: ({ table, payload }) => bronzeService.vacuum(table, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.bronze.all });
    },
    ...options,
  });
}

export function useCancelBronzeJobMutation(
  options?: UseMutationOptions<void, Error, string>,
) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (jobId) => bronzeService.cancelJob(jobId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.bronze.jobs() });
    },
    ...options,
  });
}

export function useBronzeDeletePartitionMutation(
  options?: UseMutationOptions<void, Error, { table: string; date: string }>,
) {
  const qc = useQueryClient();
  return useMutation<void, Error, { table: string; date: string }>({
    mutationFn: ({ table, date }) => bronzeService.deletePartition(table, date),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.bronze.all });
    },
    ...options,
  });
}
