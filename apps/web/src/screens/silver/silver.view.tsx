import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useSilverTablesQuery,
  useSilverJobsQuery,
  useSilverJobStatsQuery,
  useRefreshSilverMutation,
} from '@/services/queries';
import {
  Tag,
  Button,
  EmptyState,
  ErrorBoundary,
  ScreenPageHeader,
  ScreenSection,
  ScreenLoading,
  ScreenError,
  SearchInput,
  SilverTableCard,
  SilverTableDetail,
  TransformForm,
} from '@/components';

function TablesGrid({
  search,
  onSelect,
}: {
  search: string;
  onSelect: (name: string) => void;
}) {
  const refreshMutation = useRefreshSilverMutation();
  const params = search === '' ? { limit: 24 } : { limit: 24, search };
  const tablesQuery = useSilverTablesQuery(params);

  if (tablesQuery.isLoading) return <ScreenLoading rows={6} variant="grid" />;
  if (tablesQuery.isError) {
    return <ScreenError error={tablesQuery.error} onRetry={() => void tablesQuery.refetch()} compact />;
  }
  const items =
    (tablesQuery.data as { items?: ReadonlyArray<{ name: string }> } | undefined)?.items ?? [];
  if (items.length === 0) {
    return <EmptyState compact title="No silver tables" />;
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((table) => (
        <SilverTableCardWrapper
          key={table.name}
          name={table.name}
          onClick={onSelect}
          onRefresh={() => refreshMutation.mutate(table.name)}
          refreshing={refreshMutation.isPending}
        />
      ))}
    </div>
  );
}

function SilverTableCardWrapper({
  name,
  onClick,
  onRefresh,
  refreshing,
}: {
  name: string;
  onClick: (n: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const tableQuery = useSilverTablesQuery({ limit: 24, search: name });
  const table = (tableQuery.data as { items?: ReadonlyArray<{
    name: string;
    database: string;
    format: 'delta' | 'parquet';
    sizeBytes: number;
    rowCount: number;
    partitionBy: ReadonlyArray<string>;
    sourceTable?: string;
    transformRule?: string;
    lastTransformedAt?: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    createdAt: string;
    updatedAt: string;
  }> } | undefined)?.items?.[0];
  if (table === undefined) {
    return <ScreenLoading rows={1} />;
  }
  return (
    <SilverTableCard
      table={table}
      onClick={() => onClick(name)}
      onRefresh={onRefresh}
      refreshing={refreshing}
    />
  );
}

function JobsList() {
  const jobsQuery = useSilverJobsQuery();
  if (jobsQuery.isLoading) return <ScreenLoading rows={4} />;
  if (jobsQuery.isError) {
    return <ScreenError error={jobsQuery.error} onRetry={() => void jobsQuery.refetch()} compact />;
  }
  const items = jobsQuery.data ?? [];
  if (items.length === 0) {
    return <EmptyState compact title="No transform jobs" />;
  }
  return (
    <div className="flex flex-col gap-2">
      {items.slice(0, 10).map((job) => (
        <div
          key={job.jobId}
          className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-3"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-50">
              {job.table}
            </p>
            <p className="text-[10px] text-neutral-500">
              {job.recordsProcessed} processed · {job.recordsInserted} inserted · {job.recordsUpdated} updated
            </p>
          </div>
          <Tag
            size="sm"
            variant={
              job.status === 'success'
                ? 'success'
                : job.status === 'failed'
                ? 'error'
                : job.status === 'running'
                ? 'info'
                : 'warning'
            }
          >
            {job.status}
          </Tag>
        </div>
      ))}
    </div>
  );
}

function JobStatsBar() {
  const statsQuery = useSilverJobStatsQuery();
  const stats = statsQuery.data;
  if (statsQuery.isLoading || stats === null || stats === undefined) {
    return <ScreenLoading rows={1} />;
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-lg border border-white/5 bg-white/5 p-3">
        <p className="text-[10px] uppercase tracking-wider text-neutral-500">Total</p>
        <p className="mt-1 text-xl font-bold text-neutral-900 dark:text-neutral-50">{stats.total}</p>
      </div>
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
        <p className="text-[10px] uppercase tracking-wider text-emerald-500">Success</p>
        <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">{stats.success}</p>
      </div>
      <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
        <p className="text-[10px] uppercase tracking-wider text-sky-500">Running</p>
        <p className="mt-1 text-xl font-bold text-sky-600 dark:text-sky-400">{stats.running}</p>
      </div>
      <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
        <p className="text-[10px] uppercase tracking-wider text-violet-500">Records</p>
        <p className="mt-1 text-base font-bold text-violet-600 dark:text-violet-400">
          {formatNumber(stats.totalRecordsProcessed)}
        </p>
      </div>
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function SilverView() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [transformTable, setTransformTable] = useState<string | null>(null);
  const [tab, setTab] = useState<'tables' | 'jobs'>('tables');

  return (
    <ErrorBoundary>
      <div className="flex h-full flex-col gap-4">
        <ScreenPageHeader
          iconName="Silver"
          titleKey="screens.silver.title"
          subtitleKey="screens.silver.subtitle"
          descriptionKey="screens.silver.description"
          accent="silver"
          actions={
            <Button
              variant="primary"
              size="sm"
              onClick={() => setTransformTable(selected ?? '')}
              disabled={selected === null}
            >
              {t('screens.silver.transform')}
            </Button>
          }
        />
        <JobStatsBar />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-white/5 bg-white/5 p-1">
            {(['tables', 'jobs'] as const).map((k) => (
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
                {t(`screens.silver.${k}`)}
              </button>
            ))}
          </div>
          {tab === 'tables' ? (
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={t('screens.silver.search')}
              className="w-72"
            />
          ) : null}
        </div>
        <div className="flex-1 overflow-hidden">
          {tab === 'tables' ? (
            <ScreenSection title={t('screens.silver.tables')} padded={false}>
              <div className="p-4">
                <TablesGrid search={search} onSelect={setSelected} />
              </div>
            </ScreenSection>
          ) : (
            <ScreenSection title={t('screens.silver.jobs')} padded={false}>
              <div className="p-4">
                <JobsList />
              </div>
            </ScreenSection>
          )}
        </div>
        <SilverTableDetail table={selected} onClose={() => setSelected(null)} />
        {transformTable !== null ? (
          <TransformForm
            open={transformTable !== null && transformTable !== ''}
            table={transformTable}
            onClose={() => setTransformTable(null)}
          />
        ) : null}
      </div>
    </ErrorBoundary>
  );
}