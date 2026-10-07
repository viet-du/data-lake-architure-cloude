import { useTranslation } from 'react-i18next';
import { Tag, EmptyState, ScreenLoading, ScreenError } from '@/components';
import type { KafkaConsumerGroupLag } from '@/types/entities';

export interface KafkaPartitionTableProps {
  lag: ReadonlyArray<KafkaConsumerGroupLag> | undefined;
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  onRetry?: () => void;
  groupId: string;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function KafkaPartitionTable({
  lag,
  isLoading,
  isError,
  error,
  onRetry,
}: KafkaPartitionTableProps) {
  const { t } = useTranslation();
  if (isLoading) return <ScreenLoading rows={3} />;
  if (isError) {
    return <ScreenError error={error ?? new Error('Unknown error')} onRetry={onRetry} compact />;
  }
  const items = lag ?? [];
  if (items.length === 0) {
    return <EmptyState compact title={t('kafka.noLag')} />;
  }
  return (
    <div className="overflow-hidden rounded-lg border border-white/10">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-white/5">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">
                Partition
              </th>
              <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">
                Topic
              </th>
              <th className="px-3 py-2 text-right font-semibold text-neutral-700 dark:text-neutral-300">
                Current
              </th>
              <th className="px-3 py-2 text-right font-semibold text-neutral-700 dark:text-neutral-300">
                Log End
              </th>
              <th className="px-3 py-2 text-right font-semibold text-neutral-700 dark:text-neutral-300">
                Lag
              </th>
              <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => {
              const lagging = it.lag > 0;
              return (
                <tr key={idx} className="border-t border-white/5 hover:bg-white/5">
                  <td className="px-3 py-1.5 font-mono text-neutral-300">p{it.partition}</td>
                  <td className="px-3 py-1.5 font-mono text-[10px] text-neutral-500">
                    {it.topic}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-neutral-700 dark:text-neutral-300">
                    {formatNumber(it.currentOffset)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-neutral-700 dark:text-neutral-300">
                    {formatNumber(it.logEndOffset)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-neutral-700 dark:text-neutral-300">
                    {formatNumber(it.lag)}
                  </td>
                  <td className="px-3 py-1.5">
                    <Tag size="sm" variant={lagging ? 'warning' : 'success'}>
                      {lagging ? 'lagging' : 'in-sync'}
                    </Tag>
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