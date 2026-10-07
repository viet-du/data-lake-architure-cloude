import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useDQRulesQuery,
  useDQSummaryQuery,
  useDQRunsQuery,
  useRunDQRuleMutation,
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
  DQRuleCard,
  DQRuleDetail,
  DQSummaryBar,
  DQRunList,
  DQSuiteForm,
} from '@/components';
import { useToast } from '@/hooks';

function RulesList({
  search,
  onSelect,
  onRun,
}: {
  search: string;
  onSelect: (id: string) => void;
  onRun: (id: string) => void;
}) {
  const rulesQuery = useDQRulesQuery();
  if (rulesQuery.isLoading) return <ScreenLoading rows={6} variant="grid" />;
  if (rulesQuery.isError) {
    return <ScreenError error={rulesQuery.error} onRetry={() => void rulesQuery.refetch()} compact />;
  }
  const items = rulesQuery.data ?? [];
  const filtered = search === '' ? items : items.filter((r) => r.ruleName.toLowerCase().includes(search.toLowerCase()) || r.tableName.toLowerCase().includes(search.toLowerCase()));
  if (filtered.length === 0) {
    return <EmptyState compact title="No DQ rules" />;
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {filtered.map((rule) => (
        <DQRuleCard
          key={rule.ruleId}
          rule={rule}
          onClick={() => onSelect(rule.ruleId)}
          onRun={() => onRun(rule.ruleId)}
        />
      ))}
    </div>
  );
}

function RunsSection() {
  const runsQuery = useDQRunsQuery({ limit: 30 });
  return (
    <div className="flex flex-col gap-2">
      <DQRunList
        runs={runsQuery.data}
        isLoading={runsQuery.isLoading}
        isError={runsQuery.isError}
        error={runsQuery.error}
        onRetry={() => void runsQuery.refetch()}
      />
    </div>
  );
}

export function DQView() {
  const { t } = useTranslation();
  const toast = useToast();
  const [tab, setTab] = useState<'rules' | 'runs'>('rules');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [suiteOpen, setSuiteOpen] = useState(false);

  const summaryQuery = useDQSummaryQuery();
  const runMut = useRunDQRuleMutation();

  function handleRun(ruleId: string): void {
    runMut.mutate(ruleId, {
      onSuccess: () => toast.success(t('dq.runStarted')),
      onError: (e) => toast.error(t('dq.error.run'), e.message),
    });
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
            <Button
              variant="primary"
              size="sm"
              onClick={() => setSuiteOpen(true)}
            >
              {t('screens.dq.runSuite')}
            </Button>
          }
        />
        <DQSummaryBar
          summary={summaryQuery.data}
          isLoading={summaryQuery.isLoading}
          isError={summaryQuery.isError}
          error={summaryQuery.error}
          onRetry={() => void summaryQuery.refetch()}
        />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-white/5 bg-white/5 p-1">
            {(['rules', 'runs'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  tab === k
                    ? 'bg-primary-500/20 text-primary-600 dark:text-primary-300'
                    : 'text-neutral-500 hover:bg-white/5 hover:text-neutral-900 dark:hover:text-neutral-100'
                }`}
              >
                {t(`screens.dq.${k}`)}
              </button>
            ))}
          </div>
          {tab === 'rules' ? (
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={t('screens.dq.search')}
              className="w-72"
            />
          ) : null}
        </div>
        <div className="flex-1 overflow-hidden">
          {tab === 'rules' ? (
            <ScreenSection title={t('screens.dq.rules')} padded={false}>
              <div className="p-4">
                <RulesList
                  search={search}
                  onSelect={setSelected}
                  onRun={handleRun}
                />
              </div>
            </ScreenSection>
          ) : (
            <ScreenSection title={t('screens.dq.runs')} padded={false}>
              <div className="p-4">
                <RunsSection />
              </div>
            </ScreenSection>
          )}
        </div>
        <DQRuleDetail ruleId={selected} onClose={() => setSelected(null)} />
        <DQSuiteForm open={suiteOpen} onClose={() => setSuiteOpen(false)} />
      </div>
    </ErrorBoundary>
  );
}