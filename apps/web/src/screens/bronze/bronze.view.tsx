import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useBronzeTablesQuery,
  useBronzeJobsQuery,
  useBronzeJobStatsQuery,
  useCancelBronzeJobMutation,
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
  BronzeTableCard,
  BronzeTableDetail,
  IngestForm,
} from '@/components';
import { cn } from '@/theme';
import type { EBronzeJobStatus } from '@/types/entities';

const STATUS_VARIANT: Readonly<Record<EBronzeJobStatus, 'success' | 'warning' | 'error' | 'info' | 'neutral'>> = {
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

function TablesGrid({ search, onSelect }: { search: string; onSelect: (name: string) => void }) {
  const params = search === '' ? { limit: 24 } : { limit: 24, search };
  const tablesQuery = useBronzeTablesQuery(params);
  if (tablesQuery.isLoading) return <ScreenLoading rows={6} variant="grid" />;
  if (tablesQuery.isError) {
    return <ScreenError error={tablesQuery.error} onRetry={() => void tablesQuery.refetch()} compact />;
  }
  const items =
    (tablesQuery.data as { items?: ReadonlyArray<{ name: string }> } | undefined)?.items ?? [];
  if (items.length === 0) {
    return <EmptyState compact title="No bronze tables" />;
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((table) => (
        <BronzeTableCardWrapper key={table.name} name={table.name} onClick={onSelect} />
      ))}
    </div>
  );
}

function BronzeTableCardWrapper({
  name,
  onClick,
}: {
  name: string;
  onClick: (n: string) => void;
}) {
  const tableQuery = useBronzeTablesQuery({ limit: 24, search: name });
  const table = (tableQuery.data as { items?: ReadonlyArray<{
    name: string;
    database: string;
    format: 'delta' | 'parquet' | 'csv' | 'json';
    sizeBytes: number;
    rowCount: number;
    partitionBy: ReadonlyArray<string>;
    createdAt: string;
    updatedAt: string;
    lastIngestedAt?: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    location?: string;
  }> } | undefined)?.items?.[0];
  if (table === undefined) {
    return <ScreenLoading rows={1} />;
  }
  return <BronzeTableCard table={table} onClick={() => onClick(name)} />;
}

function JobsList() {
  const { t } = useTranslation();
  const jobsQuery = useBronzeJobsQuery();
  const cancelMutation = useCancelBronzeJobMutation();

  if (jobsQuery.isLoading) return <ScreenLoading rows={4} />;
  if (jobsQuery.isError) {
    return <ScreenError error={jobsQuery.error} onRetry={() => void jobsQuery.refetch()} compact />;
  }
  const items = jobsQuery.data ?? [];
  if (items.length === 0) {
    return <EmptyState compact title="No ingestion jobs" />;
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
              {new Date(job.startedAt).toLocaleString()} · {job.source}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Tag size="sm" variant={STATUS_VARIANT[job.status]}>
              {job.status}
            </Tag>
            <span className="text-[10px] text-neutral-500">
              {formatNumber(job.recordsIngested)} rows
            </span>
            {job.status === 'running' || job.status === 'queued' ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => cancelMutation.mutate(job.jobId)}
                disabled={cancelMutation.isPending}
              >
                {t('common.cancel')}
              </Button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function JobStatsBar() {
  const { t } = useTranslation();
  const statsQuery = useBronzeJobStatsQuery();
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
        <p className="text-[10px] uppercase tracking-wider text-emerald-500">{t('health.healthy')}</p>
        <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">
          {stats.success}
        </p>
      </div>
      <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
        <p className="text-[10px] uppercase tracking-wider text-sky-500">Running</p>
        <p className="mt-1 text-xl font-bold text-sky-600 dark:text-sky-400">{stats.running}</p>
      </div>
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
        <p className="text-[10px] uppercase tracking-wider text-red-500">Failed</p>
        <p className="mt-1 text-xl font-bold text-red-600 dark:text-red-400">{stats.failed}</p>
      </div>
    </div>
  );
}

export function BronzeView() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'tables' | 'jobs'>('tables');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [ingestOpen, setIngestOpen] = useState(false);

  return (
    <ErrorBoundary>
      <div className="flex h-full flex-col gap-4">
        <ScreenPageHeader
          iconName="Bronze"
          titleKey="screens.bronze.title"
          subtitleKey="screens.bronze.subtitle"
          descriptionKey="screens.bronze.description"
          accent="bronze"
          actions={
            <Button variant="primary" size="sm" onClick={() => setIngestOpen(true)}>
              {t('screens.bronze.trigger_ingest')}
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
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  tab === k
                    ? 'bg-primary-500/20 text-primary-600 dark:text-primary-300'
                    : 'text-neutral-500 hover:bg-white/5 hover:text-neutral-900 dark:hover:text-neutral-100',
                )}
              >
                {t(`screens.bronze.${k}`)}
              </button>
            ))}
          </div>
          {tab === 'tables' ? (
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={t('screens.bronze.search')}
              className="w-72"
            />
          ) : null}
        </div>
        <div className="flex-1 overflow-hidden">
          {tab === 'tables' ? (
            <ScreenSection title={t('screens.bronze.tables')} padded={false}>
              <div className="p-4">
                <TablesGrid search={search} onSelect={setSelected} />
              </div>
            </ScreenSection>
          ) : (
            <ScreenSection title={t('screens.bronze.jobs')} padded={false}>
              <div className="p-4">
                <JobsList />
              </div>
            </ScreenSection>
          )}
        </div>
        <BronzeTableDetail table={selected} onClose={() => setSelected(null)} />
        <IngestForm open={ingestOpen} onClose={() => setIngestOpen(false)} />
      </div>
    </ErrorBoundary>
  );
}