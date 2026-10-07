import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useDAGsQuery,
  useAirflowStatsQuery,
  useTriggerDAGMutation,
  usePauseDAGMutation,
  useUnpauseDAGMutation,
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
  AirflowDAGCard,
  AirflowDAGDetail,
} from '@/components';
import { useToast } from '@/hooks';

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatPct(r: number): string {
  return `${(r * 100).toFixed(1)}%`;
}

function StatsBar() {
  const statsQuery = useAirflowStatsQuery();
  const stats = statsQuery.data;
  if (statsQuery.isLoading || stats === null || stats === undefined) {
    return <ScreenLoading rows={1} />;
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-lg border border-white/5 bg-white/5 p-3">
        <p className="text-[10px] uppercase tracking-wider text-neutral-500">DAGs</p>
        <p className="mt-1 text-xl font-bold text-neutral-900 dark:text-neutral-50">
          {stats.totalDAGs}
        </p>
      </div>
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
        <p className="text-[10px] uppercase tracking-wider text-emerald-500">Active</p>
        <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">
          {stats.activeDAGs}
        </p>
      </div>
      <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
        <p className="text-[10px] uppercase tracking-wider text-sky-500">Running</p>
        <p className="mt-1 text-xl font-bold text-sky-600 dark:text-sky-400">
          {stats.runningRuns}
        </p>
      </div>
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
        <p className="text-[10px] uppercase tracking-wider text-amber-500">Success 24h</p>
        <p className="mt-1 text-base font-bold text-amber-600 dark:text-amber-400">
          {formatPct(stats.successRate24h)}
        </p>
      </div>
      <div className="col-span-2 flex items-center gap-2 rounded-lg border border-white/5 bg-white/5 p-3 sm:col-span-4">
        <span className="text-[10px] text-neutral-500">
          Total runs {formatNumber(stats.totalRuns)} · Failed 24h{' '}
          {formatNumber(stats.failedRuns24h)} · Paused {stats.pausedDAGs}
        </span>
      </div>
    </div>
  );
}

function DAGsList({
  search,
  onSelect,
  onTrigger,
  onTogglePause,
}: {
  search: string;
  onSelect: (id: string) => void;
  onTrigger: (id: string) => void;
  onTogglePause: (id: string) => void;
}) {
  const dagsQuery = useDAGsQuery();
  if (dagsQuery.isLoading) return <ScreenLoading rows={6} variant="grid" />;
  if (dagsQuery.isError) {
    return <ScreenError error={dagsQuery.error} onRetry={() => void dagsQuery.refetch()} compact />;
  }
  const items = dagsQuery.data ?? [];
  const filtered = search === '' ? items : items.filter((d) => d.dagId.toLowerCase().includes(search.toLowerCase()));
  if (filtered.length === 0) {
    return <EmptyState compact title="No DAGs" />;
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {filtered.map((dag) => (
        <AirflowDAGCard
          key={dag.dagId}
          dag={dag}
          onClick={() => onSelect(dag.dagId)}
          onTrigger={() => onTrigger(dag.dagId)}
          onTogglePause={() => onTogglePause(dag.dagId)}
        />
      ))}
    </div>
  );
}

export function AirflowView() {
  const { t } = useTranslation();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [triggeringKey, setTriggeringKey] = useState<string | null>(null);

  const triggerMut = useTriggerDAGMutation();
  const pauseMut = usePauseDAGMutation();
  const unpauseMut = useUnpauseDAGMutation();

  const dagsQuery = useDAGsQuery();
  const dags = dagsQuery.data ?? [];
  function handleTrigger(dagId: string): void {
    setTriggeringKey(dagId);
    triggerMut.mutate(
      { dagId, payload: {} },
      {
        onSuccess: (r) =>
          toast.success(t('airflow.triggered', { runId: r.runId.slice(0, 12) })),
        onError: (e) => toast.error(t('airflow.error.trigger'), e.message),
        onSettled: () => setTriggeringKey(null),
      },
    );
  }

  function handleTogglePause(dagId: string): void {
    const dag = dags.find((d) => d.dagId === dagId);
    if (dag?.isPaused === true) {
      unpauseMut.mutate(dagId, {
        onSuccess: () => toast.success(t('airflow.unpaused')),
        onError: (e) => toast.error(t('airflow.error.toggle'), e.message),
      });
    } else {
      pauseMut.mutate(dagId, {
        onSuccess: () => toast.success(t('airflow.paused')),
        onError: (e) => toast.error(t('airflow.error.toggle'), e.message),
      });
    }
  }

  return (
    <ErrorBoundary>
      <div className="flex h-full flex-col gap-4">
        <ScreenPageHeader
          iconName="Airflow"
          titleKey="screens.airflow.title"
          subtitleKey="screens.airflow.subtitle"
          descriptionKey="screens.airflow.description"
          accent="airflow"
          actions={
            <Button
              variant="primary"
              size="sm"
              onClick={() => selected !== null && handleTrigger(selected)}
              disabled={selected === null || triggeringKey !== null}
            >
              {triggeringKey !== null ? t('airflow.triggering') : t('airflow.trigger')}
            </Button>
          }
        />
        <StatsBar />
        <div className="flex items-center gap-2">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t('screens.airflow.search')}
            className="w-72"
          />
        </div>
        <div className="flex-1 overflow-hidden">
          <ScreenSection title={t('screens.airflow.dags')} padded={false}>
            <div className="p-4">
              <DAGsList
                search={search}
                onSelect={setSelected}
                onTrigger={handleTrigger}
                onTogglePause={handleTogglePause}
              />
            </div>
          </ScreenSection>
        </div>
        <AirflowDAGDetail dagId={selected} onClose={() => setSelected(null)} />
      </div>
    </ErrorBoundary>
  );
}