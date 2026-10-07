import { useTranslation } from 'react-i18next';
import { Tag, EmptyState, ScreenLoading, ScreenError, type ETagVariant } from '@/components';
import type { CrawlerRun, ECrawlerRunStatus } from '@/types/entities';

export interface CrawlerRunHistoryProps {
  runs: ReadonlyArray<CrawlerRun> | undefined;
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  onRetry?: (() => void) | undefined;
  onSelect?: (runId: string) => void;
  selectedRunId?: string | undefined;
}

const RUN_STATUS_VARIANT: Readonly<Record<ECrawlerRunStatus, ETagVariant>> = {
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

function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return '—';
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

export function CrawlerRunHistory({
  runs,
  isLoading,
  isError,
  error,
  onRetry,
  onSelect,
  selectedRunId,
}: CrawlerRunHistoryProps) {
  const { t } = useTranslation();
  if (isLoading) return <ScreenLoading rows={3} />;
  if (isError) {
    return <ScreenError error={error ?? new Error('Unknown error')} onRetry={onRetry} compact />;
  }
  if (runs === undefined || runs.length === 0) {
    return <EmptyState compact title={t('crawler.noRuns')} />;
  }
  return (
    <div className="flex flex-col gap-1">
      {runs.slice(0, 20).map((run) => {
        const active = run.runId === selectedRunId;
        return (
          <button
            key={run.runId}
            type="button"
            onClick={() => onSelect?.(run.runId)}
            className={`flex items-center justify-between rounded-lg border p-2 text-left transition-colors ${
              active
                ? 'border-primary-500/40 bg-primary-500/10'
                : 'border-white/5 bg-white/5 hover:bg-white/10'
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-[10px] text-neutral-400">
                {run.runId.slice(0, 8)}
              </p>
              <p className="text-[10px] text-neutral-500">
                {new Date(run.startedAt).toLocaleString()} · {run.triggeredBy}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-neutral-500">
                {formatNumber(run.recordsCollected)} / {formatNumber(run.pagesScraped)}p
              </span>
              <span className="text-[10px] text-neutral-500">
                {formatDuration(run.durationMs)}
              </span>
              <Tag size="sm" variant={RUN_STATUS_VARIANT[run.status]}>
                {run.status}
              </Tag>
            </div>
          </button>
        );
      })}
    </div>
  );
}