import { useMutation, useQuery, useQueryClient, type UseMutationOptions, type UseQueryOptions } from '@tanstack/react-query';
import { dqService, type ListRulesParams, type ListRunsParams, type RunSuitePayload, type ApplyPresetPayload } from '../dq';
import { QUERY_KEYS } from '../query-keys';
import type {
  DQFailedSamples,
  DQPreset,
  DQPresetApplicability,
  DQPresetApplyResult,
  DQPresetTarget,
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

/**
 * The preset applicability check.
 *
 * The check is read-only, so it is a query — the wizard calls it whenever
 * the user picks a dataset column and renders the reasons verbatim.
 */
export function useDQPresetCheckQuery(
  presetId: string,
  target: DQPresetTarget | null,
  options?: Omit<UseQueryOptions<DQPresetApplicability, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<DQPresetApplicability, Error>({
    queryKey: QUERY_KEYS.dq.presetCheck(presetId, target ?? {}),
    queryFn: () => dqService.checkPreset(presetId, target as DQPresetTarget),
    enabled: presetId.length > 0 && target !== null && target.table.length > 0,
    retry: false,
    ...options,
  });
}

/**
 * The preset application.
 *
 * The server operation is idempotent — applying the same preset to the same
 * dataset column twice returns the *existing* rule instead of a duplicate.
 */
export function useApplyDQPresetMutation(
  options?: UseMutationOptions<DQPresetApplyResult, Error, { presetId: string } & ApplyPresetPayload>,
) {
  const qc = useQueryClient();
  return useMutation<DQPresetApplyResult, Error, { presetId: string } & ApplyPresetPayload>({
    mutationFn: ({ presetId, ...payload }) => dqService.applyPreset(presetId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.dq.all });
    },
    ...options,
  });
}

/** The bounded, PII-redacted failed samples of a run. */
export function useDQFailedSamplesQuery(
  runId: string,
  limit = 10,
  options?: Omit<UseQueryOptions<DQFailedSamples, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<DQFailedSamples, Error>({
    queryKey: QUERY_KEYS.dq.runSamples(runId),
    queryFn: () => dqService.getFailedSamples(runId, limit),
    enabled: runId.length > 0,
    ...options,
  });
}
