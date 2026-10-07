import { useTranslation } from 'react-i18next';
import { Tag, EmptyState, ScreenLoading, ScreenError, type ETagVariant } from '@/components';
import type { AirflowTaskInstance } from '@/types/entities';

export interface AirflowTaskListProps {
  tasks: ReadonlyArray<AirflowTaskInstance> | undefined;
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  onRetry?: () => void;
  onSelect?: (taskId: string) => void;
  selectedTaskId?: string | undefined;
}

const STATE_VARIANT: Readonly<Record<AirflowTaskInstance['state'], ETagVariant>> = {
  success: 'success',
  failed: 'error',
  running: 'info',
  queued: 'warning',
  skipped: 'neutral',
  upstream_failed: 'error',
  retry: 'warning',
};

function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return '—';
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

export function AirflowTaskList({
  tasks,
  isLoading,
  isError,
  error,
  onRetry,
  onSelect,
  selectedTaskId,
}: AirflowTaskListProps) {
  const { t } = useTranslation();
  if (isLoading) return <ScreenLoading rows={3} />;
  if (isError) {
    return <ScreenError error={error ?? new Error('Unknown error')} onRetry={onRetry} compact />;
  }
  const items = tasks ?? [];
  if (items.length === 0) {
    return <EmptyState compact title={t('airflow.noTasks')} />;
  }
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
              <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">
                Operator
              </th>
              <th className="px-3 py-2 text-right font-semibold text-neutral-700 dark:text-neutral-300">
                Try
              </th>
              <th className="px-3 py-2 text-right font-semibold text-neutral-700 dark:text-neutral-300">
                Duration
              </th>
              <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">
                Depends on
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((task) => {
              const active = task.taskId === selectedTaskId;
              return (
                <tr
                  key={task.taskId}
                  onClick={() => onSelect?.(task.taskId)}
                  className={`cursor-pointer border-t border-white/5 transition-colors ${
                    active ? 'bg-primary-500/10' : 'hover:bg-white/5'
                  }`}
                >
                  <td className="px-3 py-1.5 font-mono text-neutral-300">{task.taskId}</td>
                  <td className="px-3 py-1.5">
                    <Tag size="sm" variant={STATE_VARIANT[task.state]}>
                      {task.state}
                    </Tag>
                  </td>
                  <td className="px-3 py-1.5 font-mono text-[10px] text-neutral-500">
                    {task.operator}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-neutral-700 dark:text-neutral-300">
                    #{task.tryNumber}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-neutral-700 dark:text-neutral-300">
                    {formatDuration(task.durationMs)}
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-1.5 font-mono text-[10px] text-neutral-500">
                    {task.dependencies.length === 0 ? '—' : task.dependencies.join(', ')}
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