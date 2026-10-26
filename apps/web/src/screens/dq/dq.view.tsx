import { i18n } from '@/i18n';
import { useState } from 'react';
import { getErrorMessage } from '@/services/api';
import { useTranslation } from 'react-i18next';
import {
  useDQRulesQuery,
  useDQSummaryQuery,
  useDQRunsQuery,
  useRunDQRuleMutation,
  useUpdateDQRuleMutation,
} from '@/services/queries';
import {
  Button,
  EmptyState,
  ErrorBoundary,
  ScreenPageHeader,
  ScreenSection,
  ScreenLoading,
  ScreenError,
  SearchInput,
  TabsContent,
  TabsList,
  TabsRoot,
  TabsTrigger,
  DQRuleCard,
  DQRuleDetail,
  DQSummaryBar,
  DQRunList,
  DQSuiteForm,
  DQPresetWizard,
  DQFailedSamplesPanel,
} from '@/components';
import { useToast } from '@/hooks';

/**
 * The Data Quality screen.
 *
 * MASTER PLAN PHASE 6: "trang Data Quality 2 nhiệm vụ rõ ràng" — the page
 * is split into two explicit groups:
 *
 *   * **Quality** — the rules, the quality gate, the runs and the failed
 *     samples. This is the *authority* on data quality.
 *   * **Explore** — the preset wizard and the entry point to the EDA
 *     explorer, i.e. the path "dataset → EDA → rule".
 *
 * The gate banner always states the denominator; an unevaluated dataset is
 * rendered as "not evaluated" and never as 100%.
 */

type DqTab = 'quality' | 'explore';

function RulesList({
  search,
  onSelect,
  onRun,
  onToggle,
}: {
  search: string;
  onSelect: (id: string) => void;
  onRun: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
}) {
  const rulesQuery = useDQRulesQuery();
  if (rulesQuery.isLoading) return <ScreenLoading rows={6} variant="grid" />;
  if (rulesQuery.isError) {
    return (
      <ScreenError error={rulesQuery.error} onRetry={() => void rulesQuery.refetch()} compact />
    );
  }
  const items = rulesQuery.data ?? [];
  const filtered =
    search === ''
      ? items
      : items.filter(
          (r) =>
            r.ruleName.toLowerCase().includes(search.toLowerCase()) ||
            r.tableName.toLowerCase().includes(search.toLowerCase()),
        );
  if (filtered.length === 0) {
    return <EmptyState compact title={i18n.t('labels.no_dq_rules')} />;
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {filtered.map((rule) => (
        <DQRuleCard
          key={rule.ruleId}
          rule={rule}
          onClick={() => onSelect(rule.ruleId)}
          onRun={() => onRun(rule.ruleId)}
          onToggle={() => onToggle(rule.ruleId, !rule.enabled)}
        />
      ))}
    </div>
  );
}

function RunsSection({
  selectedRunId,
  onSelectRun,
}: {
  selectedRunId: string | null;
  onSelectRun: (runId: string) => void;
}) {
  const runsQuery = useDQRunsQuery({ limit: 30 });
  return (
    <div className="flex flex-col gap-4">
      <DQRunList
        runs={runsQuery.data}
        isLoading={runsQuery.isLoading}
        isError={runsQuery.isError}
        error={runsQuery.error}
        onRetry={() => void runsQuery.refetch()}
        onSelect={onSelectRun}
        selectedRunId={selectedRunId ?? undefined}
      />
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          {i18n.t('dq.samples.title')}
        </h3>
        <DQFailedSamplesPanel runId={selectedRunId} limit={10} />
      </div>
    </div>
  );
}

export function DQView() {
  const { t } = useTranslation();
  const toast = useToast();
  const [tab, setTab] = useState<DqTab>('quality');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [suiteOpen, setSuiteOpen] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const summaryQuery = useDQSummaryQuery();
  const rulesQuery = useDQRulesQuery();
  const sameError =
    summaryQuery.isError &&
    rulesQuery.isError &&
    getErrorMessage(summaryQuery.error) === getErrorMessage(rulesQuery.error);
  const runMut = useRunDQRuleMutation();
  const updateMut = useUpdateDQRuleMutation();

  function handleRun(ruleId: string): void {
    runMut.mutate(ruleId, {
      onSuccess: () => toast.success(t('dq.runStarted')),
      onError: (e) => toast.error(t('dq.error.run'), e.message),
    });
  }

  function handleToggle(ruleId: string, enabled: boolean): void {
    updateMut.mutate(
      { ruleId, payload: { enabled } },
      {
        onSuccess: () => toast.success(t('dq.updated')),
        onError: (e) => toast.error(t('dq.error.update'), e.message),
      },
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex h-full flex-col gap-4">
        <ScreenPageHeader
          iconName="Analyst"
          titleKey="screens.dq.title"
          subtitleKey="screens.dq.subtitle"
          descriptionKey="screens.dq.description"
          accent="dq"
          actions={
            <>
              <Button variant="secondary" size="sm" onClick={() => setPresetOpen(true)}>
                {t('dq.preset.title')}
              </Button>
              <Button variant="primary" size="sm" onClick={() => setSuiteOpen(true)}>
                {t('screens.dq.runSuite')}
              </Button>
            </>
          }
        />

        {!sameError ? (
          <DQSummaryBar
            summary={summaryQuery.data}
            isLoading={summaryQuery.isLoading}
            isError={summaryQuery.isError}
            error={summaryQuery.error}
            onRetry={() => void summaryQuery.refetch()}
          />
        ) : null}

        <div className="flex-1 overflow-hidden">
          <TabsRoot value={tab} onValueChange={(value) => setTab(value as DqTab)}>
            {/* The tab bar MUST live inside `TabsRoot`: `TabsTrigger` reads
                the tabs context and throws when the provider is absent. The
                row also carries the search box, exactly as before the
                tabs refactor. */}
            <div className="flex items-center gap-2">
              <TabsList>
                <TabsTrigger value="quality">{t('screens.dq.quality')}</TabsTrigger>
                <TabsTrigger value="explore">{t('screens.dq.explore')}</TabsTrigger>
              </TabsList>
              {tab === 'quality' ? (
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder={t('screens.dq.search')}
                  className="w-72"
                />
              ) : null}
            </div>

            <TabsContent value="quality">
              <ScreenSection title={t('screens.dq.rules')} padded={false}>
                <div className="p-4">
                  <RulesList
                    search={search}
                    onSelect={setSelected}
                    onRun={handleRun}
                    onToggle={handleToggle}
                  />
                </div>
              </ScreenSection>
              <ScreenSection title={t('screens.dq.runs')} padded={false}>
                <div className="p-4">
                  <RunsSection
                    selectedRunId={selectedRunId}
                    onSelectRun={setSelectedRunId}
                  />
                </div>
              </ScreenSection>
            </TabsContent>

            <TabsContent value="explore">
              <ScreenSection
                title={t('screens.dq.exploreTitle')}
                description={t('screens.dq.exploreDescription')}
              >
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-neutral-500">
                    {t('screens.dq.exploreHint')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="primary" size="sm" onClick={() => setPresetOpen(true)}>
                      {t('dq.preset.title')}
                    </Button>
                  </div>
                  <ul className="flex list-disc flex-col gap-1 pl-5 text-[11px] text-neutral-500">
                    <li>{t('screens.dq.exploreStep1')}</li>
                    <li>{t('screens.dq.exploreStep2')}</li>
                    <li>{t('screens.dq.exploreStep3')}</li>
                  </ul>
                </div>
              </ScreenSection>
            </TabsContent>
          </TabsRoot>
        </div>

        <DQRuleDetail ruleId={selected} onClose={() => setSelected(null)} />
        <DQSuiteForm open={suiteOpen} onClose={() => setSuiteOpen(false)} />
        <DQPresetWizard
          open={presetOpen}
          onClose={() => setPresetOpen(false)}
          onApplied={() => setTab('quality')}
        />
      </div>
    </ErrorBoundary>
  );
}
