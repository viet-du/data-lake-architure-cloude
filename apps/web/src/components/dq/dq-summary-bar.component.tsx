import { useTranslation } from 'react-i18next';
import { Tag, type ETagVariant } from '@/components';
import type { EHealthStatus } from '@/types/commons';
import type { DQSummary } from '@/types/entities';

export interface DQSummaryBarProps {
  summary: DQSummary | undefined;
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

const HEALTH_VARIANT: Readonly<Record<EHealthStatus, ETagVariant>> = {
  healthy: 'success',
  degraded: 'warning',
  unhealthy: 'error',
};

function formatTime(s: string | undefined): string {
  if (s === undefined) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString();
}

export function DQSummaryBar({
  summary,
  isLoading,
  isError,
  error,
  onRetry,
}: DQSummaryBarProps) {
  const { t: _t } = useTranslation();
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="h-16 animate-pulse rounded-lg bg-white/5" />
        <div className="h-16 animate-pulse rounded-lg bg-white/5" />
        <div className="h-16 animate-pulse rounded-lg bg-white/5" />
        <div className="h-16 animate-pulse rounded-lg bg-white/5" />
      </div>
    );
  }
  if (isError || summary === undefined) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-500">
        {error?.message ?? 'error'}
        {onRetry !== undefined ? (
          <button type="button" onClick={onRetry} className="ml-2 underline">
            retry
          </button>
        ) : null}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-lg border border-white/5 bg-white/5 p-3">
        <p className="text-[10px] uppercase tracking-wider text-neutral-500">Total rules</p>
        <p className="mt-1 text-xl font-bold text-neutral-900 dark:text-neutral-50">
          {summary.totalRules}
        </p>
      </div>
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
        <p className="text-[10px] uppercase tracking-wider text-emerald-500">Passing</p>
        <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">
          {summary.passing}
        </p>
      </div>
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
        <p className="text-[10px] uppercase tracking-wider text-red-500">Failing</p>
        <p className="mt-1 text-xl font-bold text-red-600 dark:text-red-400">{summary.failing}</p>
      </div>
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
        <p className="text-[10px] uppercase tracking-wider text-amber-500">Warning</p>
        <p className="mt-1 text-xl font-bold text-amber-600 dark:text-amber-400">
          {summary.warning}
        </p>
      </div>
      <div className="col-span-2 flex flex-wrap items-center gap-2 rounded-lg border border-white/5 bg-white/5 p-3 sm:col-span-4">
        <Tag size="sm" variant={HEALTH_VARIANT[summary.overallStatus]}>
          {summary.overallStatus}
        </Tag>
        <span className="text-[10px] text-neutral-500">
          Last run: {formatTime(summary.lastRunAt)}
        </span>
        <span className="text-[10px] text-neutral-500">
          low {summary.bySeverity.low} · med {summary.bySeverity.medium} · high{' '}
          {summary.bySeverity.high} · crit {summary.bySeverity.critical}
        </span>
      </div>
    </div>
  );
}