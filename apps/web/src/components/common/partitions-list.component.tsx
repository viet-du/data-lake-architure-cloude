import { useTranslation } from 'react-i18next';
import { Tag, EmptyState, ScreenLoading, ScreenError, Button } from '@/components';

export interface PartitionItem {
  partition: string;
  sizeBytes: number;
  rowCount: number;
  fileCount: number;
  createdAt: string;
}

export interface PartitionsListProps {
  partitions: ReadonlyArray<PartitionItem>;
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  onRetry?: () => void;
  onDelete?: (partition: string) => void;
  deletingKey?: string | undefined;
}

function formatBytes(n: number): string {
  if (n >= 1_073_741_824) return `${(n / 1_073_741_824).toFixed(2)} GB`;
  if (n >= 1_048_576) return `${(n / 1_048_576).toFixed(2)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(2)} KB`;
  return `${n} B`;
}

export function PartitionsList({
  partitions,
  isLoading,
  isError,
  error,
  onRetry,
  onDelete,
  deletingKey,
}: PartitionsListProps) {
  const { t } = useTranslation();
  if (isLoading) return <ScreenLoading rows={4} />;
  if (isError) {
    return <ScreenError error={error ?? new Error('Unknown error')} onRetry={onRetry} compact />;
  }
  if (partitions.length === 0) {
    return <EmptyState compact title="No partitions" />;
  }
  return (
    <div className="flex flex-col gap-2">
      {partitions.map((p) => (
        <div
          key={p.partition}
          className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-3"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-sm text-neutral-900 dark:text-neutral-50">
              {p.partition}
            </p>
            <p className="text-[10px] text-neutral-500">
              {p.fileCount} files · {p.rowCount.toLocaleString()} rows · {formatBytes(p.sizeBytes)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Tag size="sm" variant="info">
              {p.fileCount} files
            </Tag>
            {onDelete !== undefined ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(p.partition)}
                disabled={deletingKey === p.partition}
              >
                {t('common.delete')}
              </Button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
