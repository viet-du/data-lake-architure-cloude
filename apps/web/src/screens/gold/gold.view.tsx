import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useGoldTablesQuery,
  useGoldJobsQuery,
  useGoldJobStatsQuery,
  useRefreshGoldMutation,
  useCategoryRevenueQuery,
  useBusinessMetricsQuery,
  useCustomerAnalyticsQuery,
  useProductPerformanceQuery,
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
  GoldTableCard,
  GoldTableDetail,
  AggregateForm,
  AdHocQueryForm,
  QueryResult,
} from '@/components';
import { cn } from '@/theme';
import type { EGoldJobStatus } from '@/types/entities';

const JOB_STATUS_VARIANT: Readonly<Record<EGoldJobStatus, 'success' | 'warning' | 'error' | 'info' | 'neutral'>> = {
  success: 'success',
  failed: 'error',
  running: 'info',
  queued: 'warning',
  cancelled: 'neutral',
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function TablesGrid({
  search,
  onSelect,
}: {
  search: string;
  onSelect: (name: string) => void;
}) {
  const refreshMutation = useRefreshGoldMutation();
  const params = search === '' ? { limit: 24 } : { limit: 24, search };
  const tablesQuery = useGoldTablesQuery(params);

  if (tablesQuery.isLoading) return <ScreenLoading rows={6} variant="grid" />;
  if (tablesQuery.isError) {
    return <ScreenError error={tablesQuery.error} onRetry={() => void tablesQuery.refetch()} compact />;
  }
  const items =
    (tablesQuery.data as { items?: ReadonlyArray<{ name: string }> } | undefined)?.items ?? [];
  if (items.length === 0) {
    return <EmptyState compact title="No gold tables" />;
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((table) => (
        <GoldTableCardWrapper
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

function GoldTableCardWrapper({
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
  const tableQuery = useGoldTablesQuery({ limit: 24, search: name });
  const table = (tableQuery.data as { items?: ReadonlyArray<{
    name: string;
    database: string;
    format: 'delta' | 'parquet';
    sizeBytes: number;
    rowCount: number;
    sourceLayer: 'silver' | 'bronze';
    sourceTables: ReadonlyArray<string>;
    aggregateType?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'group_by';
    refreshSchedule?: string;
    lastRefreshedAt?: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    createdAt: string;
    updatedAt: string;
  }> } | undefined)?.items?.[0];
  if (table === undefined) {
    return <ScreenLoading rows={1} />;
  }
  return (
    <GoldTableCard
      table={table}
      onClick={() => onClick(name)}
      onRefresh={onRefresh}
      refreshing={refreshing}
    />
  );
}

function JobsList() {
  const jobsQuery = useGoldJobsQuery();
  if (jobsQuery.isLoading) return <ScreenLoading rows={4} />;
  if (jobsQuery.isError) {
    return <ScreenError error={jobsQuery.error} onRetry={() => void jobsQuery.refetch()} compact />;
  }
  const items = jobsQuery.data ?? [];
  if (items.length === 0) {
    return <EmptyState compact title="No aggregate jobs" />;
  }
  return (
    <div className="flex flex-col gap-2">
      {items.slice(0, 8).map((job) => (
        <div
          key={job.jobId}
          className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-3"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-50">
              {job.table}
            </p>
            <p className="text-[10px] text-neutral-500">
              {job.aggregateType} · {job.recordsProcessed.toLocaleString()} records
            </p>
          </div>
          <Tag size="sm" variant={JOB_STATUS_VARIANT[job.status]}>
            {job.status}
          </Tag>
        </div>
      ))}
    </div>
  );
}

function JobStatsBar() {
  const statsQuery = useGoldJobStatsQuery();
  const stats = statsQuery.data;
  if (statsQuery.isLoading || stats === null || stats === undefined) {
    return <ScreenLoading rows={1} />;
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-lg border border-white/5 bg-white/5 p-3">
        <p className="text-[10px] uppercase tracking-wider text-neutral-500">Total</p>
        <p className="mt-1 text-xl font-bold text-neutral-900 dark:text-neutral-50">
          {stats.total}
        </p>
      </div>
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
        <p className="text-[10px] uppercase tracking-wider text-emerald-500">Success</p>
        <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">
          {stats.success}
        </p>
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

type QueryKey = 'categoryRevenue' | 'businessMetrics' | 'customerAnalytics' | 'productPerformance';

function QueryPanel({ kind }: { kind: QueryKey }) {
  const queries = {
    categoryRevenue: useCategoryRevenueQuery(),
    businessMetrics: useBusinessMetricsQuery(),
    customerAnalytics: useCustomerAnalyticsQuery(),
    productPerformance: useProductPerformanceQuery(),
  };
  const q = queries[kind];
  return (
    <QueryResult
      columns={q.data?.columns ?? []}
      rows={q.data?.rows ?? []}
      totalRows={q.data?.totalRows ?? 0}
      executionMs={q.data?.executionMs}
      isLoading={q.isLoading}
      isError={q.isError}
      error={q.error}
      onRetry={() => void q.refetch()}
    />
  );
}

export function GoldView() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'tables' | 'queries' | 'jobs'>('tables');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [aggregateOpen, setAggregateOpen] = useState(false);
  const [adhocOpen, setAdhocOpen] = useState(false);

  return (
    <ErrorBoundary>
      <div className="flex h-full flex-col gap-4">
        <ScreenPageHeader
          iconName="Gold"
          titleKey="screens.gold.title"
          subtitleKey="screens.gold.subtitle"
          descriptionKey="screens.gold.description"
          accent="gold"
          actions={
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAdhocOpen(true)}>
                {t('screens.gold.runQuery')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setAggregateOpen(true)}
                disabled={selected === null}
              >
                {t('screens.gold.aggregate')}
              </Button>
            </div>
          }
        />
        <JobStatsBar />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-white/5 bg-white/5 p-1">
            {(['tables', 'queries', 'jobs'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  tab === k
                    ? 'bg-primary-500/20 text-primary-600 dark:text-primary-300'
                    : 'text-neutral-500 hover:bg-white/5 hover:text-neutral-900 dark:hover:text-neutral-100',
                )}
              >
                {t(`screens.gold.${k}`)}
              </button>
            ))}
          </div>
          {tab === 'tables' ? (
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={t('screens.gold.search')}
              className="w-72"
            />
          ) : null}
        </div>
        <div className="flex-1 overflow-hidden">
          {tab === 'tables' ? (
            <ScreenSection title={t('screens.gold.tables')} padded={false}>
              <div className="p-4">
                <TablesGrid search={search} onSelect={setSelected} />
              </div>
            </ScreenSection>
          ) : null}
          {tab === 'queries' ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <ScreenSection title={t('gold.queries.categoryRevenue')}>
                <QueryPanel kind="categoryRevenue" />
              </ScreenSection>
              <ScreenSection title={t('gold.queries.businessMetrics')}>
                <QueryPanel kind="businessMetrics" />
              </ScreenSection>
              <ScreenSection title={t('gold.queries.customerAnalytics')}>
                <QueryPanel kind="customerAnalytics" />
              </ScreenSection>
              <ScreenSection title={t('gold.queries.productPerformance')}>
                <QueryPanel kind="productPerformance" />
              </ScreenSection>
            </div>
          ) : null}
          {tab === 'jobs' ? (
            <ScreenSection title={t('screens.gold.jobs')} padded={false}>
              <div className="p-4">
                <JobsList />
              </div>
            </ScreenSection>
          ) : null}
        </div>
        <GoldTableDetail table={selected} onClose={() => setSelected(null)} />
        {selected !== null ? (
          <AggregateForm
            open={aggregateOpen}
            table={selected}
            onClose={() => setAggregateOpen(false)}
          />
        ) : null}
        <AdHocQueryForm open={adhocOpen} onClose={() => setAdhocOpen(false)} />
      </div>
    </ErrorBoundary>
  );
}