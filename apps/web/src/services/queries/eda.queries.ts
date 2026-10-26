import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { edaService, type ListProfilesParams } from '../eda';
import { QUERY_KEYS } from '../query-keys';
import type {
  ECompareProfilesPayload,
  ECreateProfilePayload,
  EDatasetProfile,
  EProfileAccepted,
  EProfileChart,
  EProfileComparison,
  EProfileListResult,
  EProfileSample,
  EProposeRulePayload,
  EProposedRule,
} from '@/types/entities';

export function useEdaProfilesQuery(
  params?: ListProfilesParams,
  options?: Omit<UseQueryOptions<EProfileListResult, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<EProfileListResult, Error>({
    queryKey: QUERY_KEYS.eda.profiles(params),
    queryFn: () => edaService.listProfiles(params),
    ...options,
  });
}

export function useEdaProfileQuery(
  profileId: string,
  options?: Omit<UseQueryOptions<EDatasetProfile, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<EDatasetProfile, Error>({
    queryKey: QUERY_KEYS.eda.profile(profileId),
    queryFn: () => edaService.getProfile(profileId),
    enabled: profileId.length > 0,
    ...options,
  });
}

export function useEdaProfileChartsQuery(
  profileId: string,
  options?: Omit<
    UseQueryOptions<ReadonlyArray<EProfileChart>, Error>,
    'queryKey' | 'queryFn'
  >,
) {
  return useQuery<ReadonlyArray<EProfileChart>, Error>({
    queryKey: QUERY_KEYS.eda.profileCharts(profileId),
    queryFn: () => edaService.listCharts(profileId),
    enabled: profileId.length > 0,
    ...options,
  });
}

export function useEdaProfileSampleQuery(
  profileId: string,
  limit = 20,
  options?: Omit<UseQueryOptions<EProfileSample, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<EProfileSample, Error>({
    queryKey: QUERY_KEYS.eda.profileSample(profileId),
    queryFn: () => edaService.getSample(profileId, limit),
    enabled: profileId.length > 0,
    ...options,
  });
}

export function useCreateEdaProfileMutation(
  options?: UseMutationOptions<EProfileAccepted, Error, ECreateProfilePayload>,
) {
  const qc = useQueryClient();
  return useMutation<EProfileAccepted, Error, ECreateProfilePayload>({
    mutationFn: (payload) => edaService.createProfile(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.eda.all });
    },
    ...options,
  });
}

export function useCompareEdaProfilesMutation(
  options?: UseMutationOptions<EProfileComparison, Error, ECompareProfilesPayload>,
) {
  const qc = useQueryClient();
  return useMutation<EProfileComparison, Error, ECompareProfilesPayload>({
    mutationFn: (payload) => edaService.compare(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.eda.all });
    },
    ...options,
  });
}

export function useProposeEdaRuleMutation(
  options?: UseMutationOptions<EProposedRule, Error, EProposeRulePayload>,
) {
  const qc = useQueryClient();
  return useMutation<EProposedRule, Error, EProposeRulePayload>({
    mutationFn: (payload) => edaService.proposeRule(payload),
    onSuccess: () => {
      // A proposed rule invalidates the DQ rule list — the draft may be new.
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.dq.rules() });
    },
    ...options,
  });
}