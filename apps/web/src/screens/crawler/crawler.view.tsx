import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useCrawlerJobsQuery,
  useCrawlerStatsQuery,
  useStopCrawlerMutation,
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
  CrawlerJobCard,
  CrawlerJobDetail,
  CrawlerTriggerForm,
  type ETagVariant,
} from '@/components';
import { cn } from '@/theme';
import type { ECrawlerStatus } from '@/types/entities';

const STATUS_VARIANT: Readonly<Record<ECrawlerStatus, ETagVariant>> = {
  running: 'info',
  paused: 'warning',
  idle: 'neutral',
  completed: 'success',
  failed: 'error',
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function StatsBar() {
  const statsQuery = useCrawlerStatsQuery();
  const stats = statsQuery.data;
  if (statsQuery.isLoading || stats === null || stats === undefined) {
    return <ScreenLoading rows={1} />;
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-lg border border-white/5 bg-white/5 p-3">
        <p className="text-[10px] uppercase tracking-wider text-neutral-500">Jobs</p>
        <p className="mt-1 text-xl font-bold text-neutral-900 dark:text-neutral-50">
          {stats.totalJobs}
        </p>
      </div>
      <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
        <p className="text-[10px] uppercase tracking-wider text-sky-500">Running</p>
        <p className="mt-1 text-xl font-bold text-sky-600 dark:text-sky-400">{stats.runningJobs}</p>
      </div>
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
        <p className="text-[10px] uppercase tracking-wider text-emerald-500">Records 24h</p>
        <p className="mt-1 text-base font-bold text-emerald-600 dark:text-emerald-400">
          {formatNumber(stats.totalRecords24h)}
        </p>
      </div>
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
        <p className="text-[10px] uppercase tracking-wider text-red-500">Failed 24h</p>
        <p className="mt-1 text-base font-bold text-red-600 dark:text-red-400">
          {formatNumber(stats.failedRecords24h)}
        </p>
      </div>
    </div>
  );
}

function JobsList({
  search,
  onSelect,
  onTrigger,
  onStop,
  triggeringKey,
}: {
  search: string;
  onSelect: (n: string) => void;
  onTrigger: (n: string) => void;
  onStop: (n: string) => void;
  triggeringKey: string | null;
}) {
  const jobsQuery = useCrawlerJobsQuery();
  if (jobsQuery.isLoading) return <ScreenLoading rows={6} variant="grid" />;
  if (jobsQuery.isError) {
    return (
      <ScreenError error={jobsQuery.error} onRetry={() => void jobsQuery.refetch()} compact />
    );
  }
  const items = jobsQuery.data ?? [];
  const filtered = search === '' ? items : items.filter((j) => j.name.toLowerCase().includes(search.toLowerCase()));
  if (filtered.length === 0) {
    return <EmptyState compact title="No crawler jobs" />;
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {filtered.map((job) => (
        <CrawlerJobCard
          key={job.name}
          job={job}
          onClick={() => onSelect(job.name)}
          onRun={() => onTrigger(job.name)}
          onStop={() => onStop(job.name)}
          running={triggeringKey === job.name}
        />
      ))}
    </div>
  );
}

function JobsSummaryTable() {
  const jobsQuery = useCrawlerJobsQuery();
  if (jobsQuery.isLoading) return <ScreenLoading rows={4} />;
  if (jobsQuery.isError) {
    return (
      <ScreenError error={jobsQuery.error} onRetry={() => void jobsQuery.refetch()} compact />
    );
  }
  const items = jobsQuery.data ?? [];
  if (items.length === 0) {
    return <EmptyState compact title="No crawler jobs" />;
  }
  return (
    <div className="flex flex-col gap-2">
      {items.map((job) => (
        <div
          key={job.name}
          className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-3"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-50">
              {job.name}
            </p>
            <p className="text-[10px] text-neutral-500">
              {job.source} · {job.category} · {job.ratePerMinute}/min
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-neutral-500">
              {formatNumber(job.recordsCollected)} records
            </span>
            <Tag size="sm" variant={STATUS_VARIANT[job.status]}>
              {job.status}
            </Tag>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CrawlerView() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'jobs' | 'overview'>('jobs');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [triggering, _setTriggering] = useState<string | null>(null);
  const [triggerFormFor, setTriggerFormFor] = useState<string | null>(null);

  const stopMutation = useStopCrawlerMutation();

  async function handleTrigger(name: string): Promise<void> {
    setTriggerFormFor(name);
  }

  function handleStop(name: string): void {
    stopMutation.mutate(name);
  }

  return (
    <ErrorBoundary>
      <div className="flex h-full flex-col gap-4">
        <ScreenPageHeader
          iconName="Pipeline"
          titleKey="screens.crawler.title"
          subtitleKey="screens.crawler.subtitle"
          descriptionKey="screens.crawler.description"
          accent="crawler"
          actions={
            <Button
              variant="primary"
              size="sm"
              onClick={() => setTriggerFormFor(selected ?? '')}
              disabled={selected === null}
            >
              {t('screens.crawler.trigger')}
            </Button>
          }
        />
        <StatsBar />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-white/5 bg-white/5 p-1">
            {(['jobs', 'overview'] as const).map((k) => (
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
                {t(`screens.crawler.${k}`)}
              </button>
            ))}
          </div>
          {tab === 'jobs' ? (
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={t('screens.crawler.search')}
              className="w-72"
            />
          ) : null}
        </div>
        <div className="flex-1 overflow-hidden">
          {tab === 'jobs' ? (
            <ScreenSection title={t('screens.crawler.jobs')} padded={false}>
              <div className="p-4">
                <JobsList
                  search={search}
                  onSelect={setSelected}
                  onTrigger={handleTrigger}
                  onStop={handleStop}
                  triggeringKey={triggering}
                />
              </div>
            </ScreenSection>
          ) : (
            <ScreenSection title={t('screens.crawler.overview')} padded={false}>
              <div className="p-4">
                <JobsSummaryTable />
              </div>
            </ScreenSection>
          )}
        </div>
        <CrawlerJobDetail name={selected} onClose={() => setSelected(null)} />
        {triggerFormFor !== null ? (
          <CrawlerTriggerForm
            open={triggerFormFor !== null}
            name={triggerFormFor}
            onClose={() => setTriggerFormFor(null)}
          />
        ) : null}
      </div>
    </ErrorBoundary>
  );
}