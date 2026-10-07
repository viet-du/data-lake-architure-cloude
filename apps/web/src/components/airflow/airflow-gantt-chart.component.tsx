import { useTranslation } from 'react-i18next';
import { EmptyState, ScreenLoading, ScreenError, Tag, type ETagVariant } from '@/components';
import type { AirflowGanttEntry } from '@/types/entities';

export interface AirflowGanttChartProps {
  entries: ReadonlyArray<AirflowGanttEntry> | undefined;
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

const STATE_VARIANT: Readonly<Record<AirflowGanttEntry['state'], ETagVariant>> = {
  success: 'success',
  failed: 'error',
  running: 'info',
  queued: 'warning',
  skipped: 'neutral',
};

const STATE_BG: Readonly<Record<AirflowGanttEntry['state'], string>> = {
  success: 'bg-emerald-500/60',
  failed: 'bg-red-500/60',
  running: 'bg-sky-500/60',
  queued: 'bg-amber-500/60',
  skipped: 'bg-neutral-500/40',
};

function formatOffset(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

export function AirflowGanttChart({
  entries,
  isLoading,
  isError,
  error,
  onRetry,
}: AirflowGanttChartProps) {
  const { t } = useTranslation();
  if (isLoading) return <ScreenLoading rows={3} />;
  if (isError) {
    return <ScreenError error={error ?? new Error('Unknown error')} onRetry={onRetry} compact />;
  }
  const items = entries ?? [];
  if (items.length === 0) {
    return <EmptyState compact title={t('airflow.noGantt')} />;
  }
  const max = Math.max(1, ...items.map((e) => e.startOffset + e.duration));
  return (
    <div className="overflow-hidden rounded-lg border border-white/10">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-white/5">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">
                Task
              </th>
              <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">
                State
              </th>
              <th className="px-3 py-2 text-right font-semibold text-neutral-700 dark:text-neutral-300">
                Offset
              </th>
              <th className="px-3 py-2 text-right font-semibold text-neutral-700 dark:text-neutral-300">
                Duration
              </th>
              <th className="w-1/2 px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">
                Timeline
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const left = (it.startOffset / max) * 100;
              const width = Math.max(0.5, (it.duration / max) * 100);
              return (
                <tr key={it.taskId} className="border-t border-white/5">
                  <td className="px-3 py-1.5 font-mono text-neutral-300">{it.taskId}</td>
                  <td className="px-3 py-1.5">
                    <Tag size="sm" variant={STATE_VARIANT[it.state]}>
                      {it.state}
                    </Tag>
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-neutral-700 dark:text-neutral-300">
                    {formatOffset(it.startOffset)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-neutral-700 dark:text-neutral-300">
                    {formatOffset(it.duration)}
                  </td>
                  <td className="relative h-6 px-3 py-1">
                    <div className="relative h-2 w-full overflow-hidden rounded bg-white/5">
                      <div
                        className={`absolute top-0 h-2 rounded ${STATE_BG[it.state]}`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                      />
                    </div>
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