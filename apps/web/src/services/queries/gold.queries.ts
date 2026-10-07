import { useMutation, useQuery, useQueryClient, type UseMutationOptions, type UseQueryOptions } from '@tanstack/react-query';
import { goldService, type AdHocQueryParams, type AggregateAllPayload, type AggregatePayload, type ListGoldTablesParams } from '../gold';
import { QUERY_KEYS } from '../query-keys';
import type {
  GoldAggregateJob,
  GoldAggregateResult,
  GoldJobsStats,
  GoldQueryResult,
  GoldTable,
  GoldTableHistory,
  GoldTableSample,
  GoldTableStats,
} from '@/types/entities';

export function useGoldTablesQuery(
  params?: ListGoldTablesParams,
  options?: Omit<UseQueryOptions<unknown, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<unknown, Error>({
    queryKey: QUERY_KEYS.gold.tables(params),
    queryFn: () => goldService.listTables(params),
    ...options,
  });
}

export function useGoldTableQuery(
  table: string,
  options?: Omit<UseQueryOptions<GoldTable, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<GoldTable, Error>({
    queryKey: QUERY_KEYS.gold.table(table),
    queryFn: () => goldService.getTable(table),
    enabled: table.length > 0,
    ...options,
  });
}

export function useGoldTableSampleQuery(
  table: string,
  limit?: number,
  options?: Omit<UseQueryOptions<GoldTableSample, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<GoldTableSample, Error>({
    queryKey: [...QUERY_KEYS.gold.tableSample(table), limit ?? 100],
    queryFn: () => goldService.getTableSample(table, limit),
    enabled: table.length > 0,
    ...options,
  });
}

export function useGoldTableStatsQuery(
  table: string,
  options?: Omit<UseQueryOptions<GoldTableStats, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<GoldTableStats, Error>({
    queryKey: QUERY_KEYS.gold.tableStats(table),
    queryFn: () => goldService.getTableStats(table),
    enabled: table.length > 0,
    ...options,
  });
}

export function useGoldTableHistoryQuery(
  table: string,
  options?: Omit<UseQueryOptions<ReadonlyArray<GoldTableHistory>, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<ReadonlyArray<GoldTableHistory>, Error>({
    queryKey: QUERY_KEYS.gold.tableHistory(table),
    queryFn: () => goldService.getTableHistory(table),
    enabled: table.length > 0,
    ...options,
  });
}

export function useGoldTableLineageQuery(
  table: string,
  options?: Omit<UseQueryOptions<unknown, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<unknown, Error>({
    queryKey: QUERY_KEYS.gold.tableLineage(table),
    queryFn: () => goldService.getTableLineage(table),
    enabled: table.length > 0,
    ...options,
  });
}

export function useGoldJobsQuery(
  options?: Omit<UseQueryOptions<ReadonlyArray<GoldAggregateJob>, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<ReadonlyArray<GoldAggregateJob>, Error>({
    queryKey: QUERY_KEYS.gold.jobs(),
    queryFn: () => goldService.listJobs(),
    ...options,
  });
}

export function useGoldJobStatsQuery(
  options?: Omit<UseQueryOptions<GoldJobsStats, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<GoldJobsStats, Error>({
    queryKey: QUERY_KEYS.gold.jobsStats(),
    queryFn: () => goldService.getJobStats(),
    ...options,
  });
}

export function useGoldJobQuery(
  jobId: string,
  options?: Omit<UseQueryOptions<GoldAggregateJob, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<GoldAggregateJob, Error>({
    queryKey: QUERY_KEYS.gold.job(jobId),
    queryFn: () => goldService.getJob(jobId),
    enabled: jobId.length > 0,
    ...options,
  });
}

export function useCategoryRevenueQuery(
  options?: Omit<UseQueryOptions<GoldQueryResult, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<GoldQueryResult, Error>({
    queryKey: QUERY_KEYS.gold.categoryRevenue(),
    queryFn: () => goldService.getCategoryRevenue(),
    ...options,
  });
}

export function useBusinessMetricsQuery(
  options?: Omit<UseQueryOptions<GoldQueryResult, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<GoldQueryResult, Error>({
    queryKey: QUERY_KEYS.gold.businessMetrics(),
    queryFn: () => goldService.getBusinessMetrics(),
    ...options,
  });
}

export function useCustomerAnalyticsQuery(
  options?: Omit<UseQueryOptions<GoldQueryResult, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<GoldQueryResult, Error>({
    queryKey: QUERY_KEYS.gold.customerAnalytics(),
    queryFn: () => goldService.getCustomerAnalytics(),
    ...options,
  });
}

export function useProductPerformanceQuery(
  options?: Omit<UseQueryOptions<GoldQueryResult, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<GoldQueryResult, Error>({
    queryKey: QUERY_KEYS.gold.productPerformance(),
    queryFn: () => goldService.getProductPerformance(),
    ...options,
  });
}

export function useAggregateMutation(
  options?: UseMutationOptions<GoldAggregateResult, Error, { table: string; payload: AggregatePayload }>,
) {
  const qc = useQueryClient();
  return useMutation<GoldAggregateResult, Error, { table: string; payload: AggregatePayload }>({
    mutationFn: ({ table, payload }) => goldService.aggregate(table, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.gold.all });
    },
    ...options,
  });
}

export function useAggregateAllMutation(
  options?: UseMutationOptions<ReadonlyArray<GoldAggregateResult>, Error, AggregateAllPayload>,
) {
  const qc = useQueryClient();
  return useMutation<ReadonlyArray<GoldAggregateResult>, Error, AggregateAllPayload>({
    mutationFn: (payload) => goldService.aggregateAll(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.gold.all });
    },
    ...options,
  });
}

export function useRefreshGoldMutation(
  options?: UseMutationOptions<GoldAggregateJob, Error, string>,
) {
  const qc = useQueryClient();
  return useMutation<GoldAggregateJob, Error, string>({
    mutationFn: (table) => goldService.refresh(table),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.gold.all });
    },
    ...options,
  });
}

export function useAdHocQuery(
  params: AdHocQueryParams,
  options?: Omit<UseQueryOptions<GoldQueryResult, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<GoldQueryResult, Error>({
    queryKey: [...QUERY_KEYS.gold.all, 'adHoc', params],
    queryFn: () => goldService.runAdHocQuery(params),
    enabled: params.sql.length > 0,
    ...options,
  });
}
