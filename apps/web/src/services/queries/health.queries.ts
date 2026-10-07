import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { healthService } from '../health';
import { QUERY_KEYS } from '../query-keys';
import type { HealthDeepResponse, HealthInfo, HealthResponse } from '@/types/entities';

export function useHealthQuery(
  options?: Omit<UseQueryOptions<HealthResponse, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<HealthResponse, Error>({
    queryKey: QUERY_KEYS.health.root(),
    queryFn: () => healthService.getHealth(),
    refetchInterval: 30_000,
    ...options,
  });
}

export function useDeepHealthQuery(
  options?: Omit<UseQueryOptions<HealthDeepResponse, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<HealthDeepResponse, Error>({
    queryKey: QUERY_KEYS.health.deep(),
    queryFn: () => healthService.getDeepHealth(),
    refetchInterval: 30_000,
    ...options,
  });
}

export function useInfoQuery(
  options?: Omit<UseQueryOptions<HealthInfo, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<HealthInfo, Error>({
    queryKey: QUERY_KEYS.health.info(),
    queryFn: () => healthService.getInfo(),
    staleTime: 5 * 60_000,
    ...options,
  });
}
