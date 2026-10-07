import { useTranslation } from 'react-i18next';
import { Tag, EmptyState, ScreenLoading, ScreenError, type ETagVariant } from '@/components';
import type { KafkaConsumerGroup } from '@/types/entities';

type KafkaConsumerGroupState = KafkaConsumerGroup['state'];

export interface KafkaConsumerGroupTableProps {
  groups: ReadonlyArray<KafkaConsumerGroup> | undefined;
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  onRetry?: () => void;
  onSelect?: (groupId: string) => void;
  selectedGroupId?: string | undefined;
}

const STATE_VARIANT: Readonly<Record<KafkaConsumerGroupState, ETagVariant>> = {
  Stable: 'success',
  PreparingRebalance: 'warning',
  CompletingRebalance: 'warning',
  Empty: 'neutral',
  Dead: 'error',
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function KafkaConsumerGroupTable({
  groups,
  isLoading,
  isError,
  error,
  onRetry,
  onSelect,
  selectedGroupId,
}: KafkaConsumerGroupTableProps) {
  const { t } = useTranslation();
  if (isLoading) return <ScreenLoading rows={3} />;
  if (isError) {
    return <ScreenError error={error ?? new Error('Unknown error')} onRetry={onRetry} compact />;
  }
  const items = groups ?? [];
  if (items.length === 0) {
    return <EmptyState compact title={t('kafka.noGroups')} />;
  }
  return (
    <div className="overflow-hidden rounded-lg border border-white/10">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-white/5">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">
                Group ID
              </th>
              <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">
                State
              </th>
              <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">
                Protocol
              </th>
              <th className="px-3 py-2 text-right font-semibold text-neutral-700 dark:text-neutral-300">
                Members
              </th>
              <th className="px-3 py-2 text-right font-semibold text-neutral-700 dark:text-neutral-300">
                Total lag
              </th>
              <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">
                Topics
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((g) => {
              const active = g.groupId === selectedGroupId;
              return (
                <tr
                  key={g.groupId}
                  onClick={() => onSelect?.(g.groupId)}
                  className={`cursor-pointer border-t border-white/5 transition-colors ${
                    active ? 'bg-primary-500/10' : 'hover:bg-white/5'
                  }`}
                >
                  <td className="px-3 py-1.5 font-mono text-neutral-300">{g.groupId}</td>
                  <td className="px-3 py-1.5">
                    <Tag size="sm" variant={STATE_VARIANT[g.state] ?? 'neutral'}>
                      {g.state}
                    </Tag>
                  </td>
                  <td className="px-3 py-1.5 font-mono text-[10px] text-neutral-500">
                    {g.protocol}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-neutral-700 dark:text-neutral-300">
                    {g.members}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-neutral-700 dark:text-neutral-300">
                    {formatNumber(g.totalLag)}
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-1.5 font-mono text-[10px] text-neutral-500">
                    {g.topics.join(', ')}
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