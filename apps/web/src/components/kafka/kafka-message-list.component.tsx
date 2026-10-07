import { useTranslation } from 'react-i18next';
import { EmptyState, ScreenLoading, ScreenError, Tag } from '@/components';
import type { KafkaMessage } from '@/types/entities';

export interface KafkaMessageListProps {
  messages: ReadonlyArray<KafkaMessage> | undefined;
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  onRetry?: () => void;
  maxRows?: number;
}

function formatTimestamp(ts: string): string {
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return ts;
  return date.toISOString();
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n)}…`;
}

export function KafkaMessageList({
  messages,
  isLoading,
  isError,
  error,
  onRetry,
  maxRows = 30,
}: KafkaMessageListProps) {
  const { t } = useTranslation();
  if (isLoading) return <ScreenLoading rows={3} />;
  if (isError) {
    return <ScreenError error={error ?? new Error('Unknown error')} onRetry={onRetry} compact />;
  }
  const items = messages ?? [];
  if (items.length === 0) {
    return <EmptyState compact title={t('kafka.noMessages')} />;
  }
  return (
    <div className="overflow-hidden rounded-lg border border-white/10">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-white/5">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">
                P
              </th>
              <th className="px-3 py-2 text-right font-semibold text-neutral-700 dark:text-neutral-300">
                Offset
              </th>
              <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">
                Timestamp
              </th>
              <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">
                Key
              </th>
              <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">
                Value
              </th>
              <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">
                Headers
              </th>
            </tr>
          </thead>
          <tbody>
            {items.slice(0, maxRows).map((msg, idx) => (
              <tr key={idx} className="border-t border-white/5 hover:bg-white/5">
                <td className="px-3 py-1.5 font-mono text-neutral-300">p{msg.partition}</td>
                <td className="px-3 py-1.5 text-right font-mono text-neutral-700 dark:text-neutral-300">
                  {msg.offset}
                </td>
                <td className="px-3 py-1.5 font-mono text-[10px] text-neutral-500">
                  {formatTimestamp(msg.timestamp)}
                </td>
                <td className="max-w-[160px] truncate px-3 py-1.5 font-mono text-[10px] text-neutral-300">
                  {msg.key ?? '—'}
                </td>
                <td className="max-w-[360px] truncate px-3 py-1.5 font-mono text-[10px] text-neutral-300">
                  {truncate(msg.value, 80)}
                </td>
                <td className="px-3 py-1.5">
                  {msg.headers !== undefined && Object.keys(msg.headers).length > 0 ? (
                    <Tag size="sm" variant="info">
                      {Object.keys(msg.headers).length}
                    </Tag>
                  ) : (
                    <span className="text-[10px] text-neutral-500">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}