import { useMutation, useQuery, useQueryClient, type UseMutationOptions, type UseQueryOptions } from '@tanstack/react-query';
import { crawlerService, type ListCrawlerRunsParams, type RunJobPayload } from '../crawler';
import { QUERY_KEYS } from '../query-keys';
import type {
  CrawlerConfig,
  CrawlerJob,
  CrawlerKafkaTopic,
  CrawlerPreviewItem,
  CrawlerRun,
  CrawlerRunItem,
  CrawlerStats,
} from '@/types/entities';

export function useCrawlerJobsQuery(
  options?: Omit<UseQueryOptions<ReadonlyArray<CrawlerJob>, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<ReadonlyArray<CrawlerJob>, Error>({
    queryKey: QUERY_KEYS.crawler.jobs(),
    queryFn: () => crawlerService.listJobs(),
    ...options,
  });
}

export function useCrawlerJobQuery(
  name: string,
  options?: Omit<UseQueryOptions<CrawlerJob, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<CrawlerJob, Error>({
    queryKey: QUERY_KEYS.crawler.job(name),
    queryFn: () => crawlerService.getJob(name),
    enabled: name.length > 0,
    ...options,
  });
}

export function useCrawlerJobConfigQuery(
  name: string,
  options?: Omit<UseQueryOptions<CrawlerConfig, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<CrawlerConfig, Error>({
    queryKey: QUERY_KEYS.crawler.jobConfig(name),
    queryFn: () => crawlerService.getConfig(name),
    enabled: name.length > 0,
    ...options,
  });
}

export function useCrawlerJobKafkaTopicQuery(
  name: string,
  options?: Omit<UseQueryOptions<CrawlerKafkaTopic, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<CrawlerKafkaTopic, Error>({
    queryKey: QUERY_KEYS.crawler.jobKafkaTopic(name),
    queryFn: () => crawlerService.getKafkaTopic(name),
    enabled: name.length > 0,
    ...options,
  });
}

export function useCrawlerJobPreviewQuery(
  name: string,
  limit?: number,
  options?: Omit<UseQueryOptions<ReadonlyArray<CrawlerPreviewItem>, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<ReadonlyArray<CrawlerPreviewItem>, Error>({
    queryKey: [...QUERY_KEYS.crawler.jobPreview(name), limit ?? 10],
    queryFn: () => crawlerService.getPreview(name, limit),
    enabled: name.length > 0,
    ...options,
  });
}

export function useCrawlerJobRunsQuery(
  name: string,
  params?: ListCrawlerRunsParams,
  options?: Omit<UseQueryOptions<ReadonlyArray<CrawlerRun>, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<ReadonlyArray<CrawlerRun>, Error>({
    queryKey: [...QUERY_KEYS.crawler.jobRuns(name), params ?? {}],
    queryFn: () => crawlerService.listRuns(name, params),
    enabled: name.length > 0,
    ...options,
  });
}

export function useCrawlerJobRunQuery(
  name: string,
  runId: string,
  options?: Omit<UseQueryOptions<CrawlerRun, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<CrawlerRun, Error>({
    queryKey: QUERY_KEYS.crawler.jobRun(name, runId),
    queryFn: () => crawlerService.getRun(name, runId),
    enabled: name.length > 0 && runId.length > 0,
    ...options,
  });
}

export function useCrawlerJobRunItemsQuery(
  name: string,
  runId: string,
  limit?: number,
  options?: Omit<UseQueryOptions<ReadonlyArray<CrawlerRunItem>, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<ReadonlyArray<CrawlerRunItem>, Error>({
    queryKey: [...QUERY_KEYS.crawler.jobRun(name, runId), 'items', limit ?? 50],
    queryFn: () => crawlerService.getRunItems(name, runId, limit),
    enabled: name.length > 0 && runId.length > 0,
    ...options,
  });
}

export function useCrawlerStatsQuery(
  options?: Omit<UseQueryOptions<CrawlerStats, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<CrawlerStats, Error>({
    queryKey: QUERY_KEYS.crawler.stats(),
    queryFn: () => crawlerService.getStats(),
    ...options,
  });
}

export function useUpdateCrawlerConfigMutation(
  options?: UseMutationOptions<CrawlerConfig, Error, { name: string; config: Partial<CrawlerConfig> }>,
) {
  const qc = useQueryClient();
  return useMutation<CrawlerConfig, Error, { name: string; config: Partial<CrawlerConfig> }>({
    mutationFn: ({ name, config }) => crawlerService.updateConfig(name, config),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.crawler.all });
    },
    ...options,
  });
}

export function useRunCrawlerMutation(
  options?: UseMutationOptions<CrawlerRun, Error, { name: string; payload: RunJobPayload; async?: boolean }>,
) {
  const qc = useQueryClient();
  return useMutation<CrawlerRun, Error, { name: string; payload: RunJobPayload; async?: boolean }>({
    mutationFn: ({ name, payload, async }) =>
      async === true ? crawlerService.runJobAsync(name, payload) : crawlerService.runJob(name, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.crawler.all });
    },
    ...options,
  });
}

export function useStopCrawlerMutation(
  options?: UseMutationOptions<void, Error, string>,
) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (name) => crawlerService.stopJob(name),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.crawler.all });
    },
    ...options,
  });
}
