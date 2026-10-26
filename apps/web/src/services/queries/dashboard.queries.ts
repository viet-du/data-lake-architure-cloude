import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { dashboardService, type DashboardActivityParams } from '../dashboard';
import { QUERY_KEYS } from '../query-keys';
import type {
  DashboardActivity,
  DashboardDependencies,
  DashboardSummary,
} from '@/types/entities';
import type { EDashboardQualityWindow } from '@/store';

/**
 * The Home summary.
 *
 * One request, one read model. The previous implementation fanned out eight
 * requests (catalog + three job stats + Kafka + Airflow + DQ + health) and
 * re-derived the semantics in the browser — which is where the double-counted
 * "Records Processed (all time)" and the false 100% quality score came from.
 *
 * The refresh interval is 30s: the summary is a live read model, and the
 * staleness of each individual metric is reported by the API itself.
 *
 * ## The query key carries the window
 *
 * The quality figure is measured over a window, so the window is part of
 * the cache identity. Two summaries over different windows are two
 * different read models and must not share a cache entry — otherwise the
 * Home card and the Schematic badge could show different pass rates while
 * claiming to be the same number.
 *
 * ## There is exactly one summary query
 *
 * The Home screen and the Schematic used to register two different query
 * functions under the *same* key (`['dashboard','summary',{}]`): one
 * returned the raw summary, the other a flattened view-model. React
 * Query caches by key, so whichever mounted first decided what the other
 * one read — and the second one then crashed or rendered the wrong shape.
 * The Home view now *derives* its view-model from this query instead of
 * registering a second one.
 */
export function useDashboardSummaryQuery(
  params: { window?: EDashboardQualityWindow } = {},
  options?: Omit<UseQueryOptions<DashboardSummary, Error>, 'queryKey' | 'queryFn'>,
) {
  const queryParams = params.window ? { window: params.window } : {};
  return useQuery<DashboardSummary, Error>({
    queryKey: QUERY_KEYS.dashboard.summary(queryParams),
    queryFn: () => dashboardService.getSummary(queryParams),
    refetchInterval: 30_000,
    staleTime: 15_000,
    ...options,
  });
}

/**
 * The activity feed.
 *
 * The feed is cursor-paged. The cursor is part of the query key, so each
 * page is cached independently and the "load more" affordance can fetch the
 * next page without discarding what is already on screen.
 */
export function useDashboardActivityQuery(
  params: DashboardActivityParams = {},
  options?: Omit<UseQueryOptions<DashboardActivity, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<DashboardActivity, Error>({
    queryKey: QUERY_KEYS.dashboard.activity(params),
    queryFn: () => dashboardService.getActivity(params),
    refetchInterval: 30_000,
    staleTime: 10_000,
    ...options,
  });
}

/** The dependency health of the current deployment. */
export function useDashboardDependenciesQuery(
  options?: Omit<UseQueryOptions<DashboardDependencies, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<DashboardDependencies, Error>({
    queryKey: QUERY_KEYS.dashboard.dependencies(),
    queryFn: () => dashboardService.getDependencies(),
    refetchInterval: 60_000,
    staleTime: 30_000,
    ...options,
  });
}
