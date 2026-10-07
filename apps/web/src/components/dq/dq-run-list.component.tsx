import { useTranslation } from 'react-i18next';
import { Tag, EmptyState, ScreenLoading, ScreenError, type ETagVariant } from '@/components';
import type { DQRun } from '@/types/entities';

export interface DQRunListProps {
  runs: ReadonlyArray<DQRun> | undefined;
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  onRetry?: () => void;
  onSelect?: (runId: string) => void;
  selectedRunId?: string | undefined;
}

const STATUS_VARIANT: Readonly<Record<DQRun['status'], ETagVariant>> = {
  success: 'success',
  failed: 'error',
  running: 'info',
  queued: 'warning',
};

function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return '—';
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function DQRunList({
  runs,
  isLoading,
  isError,
  error,
  onRetry,
  onSelect,
  selectedRunId,
}: DQRunListProps) {
  const { t } = useTranslation();
  if (isLoading) return <ScreenLoading rows={3} />;
  if (isError) {
    return <ScreenError error={error ?? new Error('Unknown error')} onRetry={onRetry} compact />;
  }
  const items = runs ?? [];
  if (items.length === 0) {
    return <EmptyState compact title={t('dq.noRuns')} />;
  }
  return (
    <div className="overflow-hidden rounded-lg border border-white/10">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-white/5">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">
                Run
              </th>
              <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">
                Status
              </th>
              <th className="px-3 py-2 text-right font-semibold text-neutral-700 dark:text-neutral-300">
                Pass
              </th>
              <th className="px-3 py-2 text-right font-semibold text-neutral-700 dark:text-neutral-300">
                Fail
              </th>
              <th className="px-3 py-2 text-right font-semibold text-neutral-700 dark:text-neutral-300">
                Warn
              </th>
              <th className="px-3 py-2 text-right font-semibold text-neutral-700 dark:text-neutral-300">
                Rows
              </th>
              <th className="px-3 py-2 text-right font-semibold text-neutral-700 dark:text-neutral-300">
                Duration
              </th>
            </tr>
          </thead>
          <tbody>
            {items.slice(0, 30).map((run) => {
              const active = run.runId === selectedRunId;
              return (
                <tr
                  key={run.runId}
                  onClick={() => onSelect?.(run.runId)}
                  className={`cursor-pointer border-t border-white/5 transition-colors ${
                    active ? 'bg-primary-500/10' : 'hover:bg-white/5'
                  }`}
                >
                  <td className="px-3 py-1.5">
                    <p className="font-mono text-[10px] text-neutral-400">
                      {run.runId.slice(0, 12)}
                    </p>
                    <p className="text-[10px] text-neutral-500">
                      {new Date(run.startedAt).toLocaleString()}
                    </p>
                  </td>
                  <td className="px-3 py-1.5">
                    <Tag size="sm" variant={STATUS_VARIANT[run.status]}>
                      {run.status}
                    </Tag>
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-emerald-500">
                    {run.passedRules}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-red-500">
                    {run.failedRules}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-amber-500">
                    {run.warningRules}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-neutral-700 dark:text-neutral-300">
                    {formatNumber(run.totalCheckedRows)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-neutral-700 dark:text-neutral-300">
                    {formatDuration(run.durationMs)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}