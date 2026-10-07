import { useMutation, useQuery, useQueryClient, type UseMutationOptions, type UseQueryOptions } from '@tanstack/react-query';
import { dqService, type ListRulesParams, type ListRunsParams, type RunSuitePayload } from '../dq';
import { QUERY_KEYS } from '../query-keys';
import type {
  DQPreset,
  DQRule,
  DQRuleCreatePayload,
  DQRuleUpdatePayload,
  DQRun,
  DQSummary,
} from '@/types/entities';

export function useDQRulesQuery(
  params?: ListRulesParams,
  options?: Omit<UseQueryOptions<ReadonlyArray<DQRule>, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<ReadonlyArray<DQRule>, Error>({
    queryKey: QUERY_KEYS.dq.rules(params),
    queryFn: () => dqService.listRules(params),
    ...options,
  });
}

export function useDQRuleQuery(
  ruleId: string,
  options?: Omit<UseQueryOptions<DQRule, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<DQRule, Error>({
    queryKey: QUERY_KEYS.dq.rule(ruleId),
    queryFn: () => dqService.getRule(ruleId),
    enabled: ruleId.length > 0,
    ...options,
  });
}

export function useDQRunsQuery(
  params?: ListRunsParams,
  options?: Omit<UseQueryOptions<ReadonlyArray<DQRun>, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<ReadonlyArray<DQRun>, Error>({
    queryKey: QUERY_KEYS.dq.runs(params),
    queryFn: () => dqService.listRuns(params),
    ...options,
  });
}

export function useDQRunQuery(
  runId: string,
  options?: Omit<UseQueryOptions<DQRun, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<DQRun, Error>({
    queryKey: QUERY_KEYS.dq.run(runId),
    queryFn: () => dqService.getRun(runId),
    enabled: runId.length > 0,
    ...options,
  });
}

export function useDQPresetsQuery(
  options?: Omit<UseQueryOptions<ReadonlyArray<DQPreset>, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<ReadonlyArray<DQPreset>, Error>({
    queryKey: QUERY_KEYS.dq.presets(),
    queryFn: () => dqService.getPresets(),
    ...options,
  });
}

export function useDQSummaryQuery(
  options?: Omit<UseQueryOptions<DQSummary, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<DQSummary, Error>({
    queryKey: QUERY_KEYS.dq.summary(),
    queryFn: () => dqService.getSummary(),
    ...options,
  });
}

export function useCreateDQRuleMutation(
  options?: UseMutationOptions<DQRule, Error, DQRuleCreatePayload>,
) {
  const qc = useQueryClient();
  return useMutation<DQRule, Error, DQRuleCreatePayload>({
    mutationFn: (payload) => dqService.createRule(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.dq.rules() });
    },
    ...options,
  });
}

export function useUpdateDQRuleMutation(
  options?: UseMutationOptions<DQRule, Error, { ruleId: string; payload: DQRuleUpdatePayload }>,
) {
  const qc = useQueryClient();
  return useMutation<DQRule, Error, { ruleId: string; payload: DQRuleUpdatePayload }>({
    mutationFn: ({ ruleId, payload }) => dqService.updateRule(ruleId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.dq.all });
    },
    ...options,
  });
}

export function useDeleteDQRuleMutation(
  options?: UseMutationOptions<void, Error, string>,
) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (ruleId) => dqService.deleteRule(ruleId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.dq.rules() });
    },
    ...options,
  });
}

export function useRunDQRuleMutation(
  options?: UseMutationOptions<DQRun, Error, string>,
) {
  const qc = useQueryClient();
  return useMutation<DQRun, Error, string>({
    mutationFn: (ruleId) => dqService.runRule(ruleId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.dq.runs() });
    },
    ...options,
  });
}

export function useRunDQSuiteMutation(
  options?: UseMutationOptions<DQRun, Error, RunSuitePayload>,
) {
  const qc = useQueryClient();
  return useMutation<DQRun, Error, RunSuitePayload>({
    mutationFn: (payload) => dqService.runSuite(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.dq.all });
    },
    ...options,
  });
}
