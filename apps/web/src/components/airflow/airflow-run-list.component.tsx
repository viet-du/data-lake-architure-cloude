import { useTranslation } from 'react-i18next';
import { Tag, EmptyState, ScreenLoading, ScreenError, type ETagVariant } from '@/components';
import type { AirflowDAGRun, EDagState } from '@/types/entities';

export interface AirflowRunListProps {
  runs: ReadonlyArray<AirflowDAGRun> | undefined;
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  onRetry?: () => void;
  onSelect?: (runId: string) => void;
  selectedRunId?: string | undefined;
}

const STATE_VARIANT: Readonly<Record<EDagState, ETagVariant>> = {
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

export function AirflowRunList({
  runs,
  isLoading,
  isError,
  error,
  onRetry,
  onSelect,
  selectedRunId,
}: AirflowRunListProps) {
  const { t } = useTranslation();
  if (isLoading) return <ScreenLoading rows={3} />;
  if (isError) {
    return <ScreenError error={error ?? new Error('Unknown error')} onRetry={onRetry} compact />;
  }
  const items = runs ?? [];
  if (items.length === 0) {
    return <EmptyState compact title={t('airflow.noRuns')} />;
  }
  return (
    <div className="flex flex-col gap-1">
      {items.slice(0, 20).map((run) => {
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
                {run.runId.slice(0, 12)}
              </p>
              <p className="text-[10px] text-neutral-500">
                {new Date(run.executionDate).toLocaleString()} · {run.triggeredBy}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-neutral-500">
                {formatDuration(run.durationMs)}
              </span>
              <Tag size="sm" variant={STATE_VARIANT[run.state]}>
                {run.state}
              </Tag>
            </div>
          </button>
        );
      })}
    </div>
  );
}