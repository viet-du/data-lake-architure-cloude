import { Tag, EmptyState, ScreenLoading, ScreenError } from '@/components';
import type { ETagVariant } from '@/components';

export interface HistoryItem {
  version: number;
  timestamp: string;
  operation: string;
  recordsAdded?: number | undefined;
  recordsRemoved?: number | undefined;
  recordsAffected?: number | undefined;
  userName?: string | undefined;
}

export interface HistoryTimelineProps {
  items: ReadonlyArray<HistoryItem>;
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

const OPERATION_VARIANT: Readonly<Record<string, ETagVariant>> = {
  WRITE: 'success',
  MERGE: 'primary',
  DELETE: 'error',
  OPTIMIZE: 'info',
  VACUUM: 'warning',
  REFRESH: 'info',
};

export function HistoryTimeline({
  items,
  isLoading,
  isError,
  error,
  onRetry,
}: HistoryTimelineProps) {
  if (isLoading) return <ScreenLoading rows={4} />;
  if (isError) {
    return <ScreenError error={error ?? new Error('Unknown error')} onRetry={onRetry} compact />;
  }
  if (items.length === 0) {
    return <EmptyState compact title="No history" />;
  }
  return (
    <ol className="flex flex-col gap-2">
      {items.map((item) => {
        const variant = OPERATION_VARIANT[item.operation] ?? 'neutral';
        const records =
          item.recordsAdded !== undefined && item.recordsRemoved !== undefined
            ? `+${item.recordsAdded} / -${item.recordsRemoved}`
            : item.recordsAffected !== undefined
              ? `${item.recordsAffected} rows`
              : '—';
        return (
          <li
            key={`${item.version}-${item.timestamp}`}
            className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-3"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="rounded-md bg-white/5 px-2 py-0.5 font-mono text-[10px] text-neutral-500">
                v{item.version}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-50">
                  {item.operation}
                </p>
                <p className="text-[10px] text-neutral-500">
                  {new Date(item.timestamp).toLocaleString()}
                  {item.userName !== undefined ? ` · ${item.userName}` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Tag size="sm" variant={variant}>
                {records}
              </Tag>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
