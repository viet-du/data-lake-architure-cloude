import { Tag, type ETagVariant } from '@/components';
import { cn } from '@/theme';
import type { KafkaTopic } from '@/types/entities';
import type { EHealthStatus } from '@/types/commons';

export interface KafkaTopicCardProps {
  topic: KafkaTopic;
  onClick: () => void;
  onProduce?: () => void;
  onDelete?: () => void;
}

const HEALTH_VARIANT: Readonly<Record<EHealthStatus, ETagVariant>> = {
  healthy: 'success',
  degraded: 'warning',
  unhealthy: 'error',
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatRetention(ms: number): string {
  if (ms >= 86_400_000) return `${Math.round(ms / 86_400_000)}d`;
  if (ms >= 3_600_000) return `${Math.round(ms / 3_600_000)}h`;
  if (ms >= 60_000) return `${Math.round(ms / 60_000)}m`;
  return `${Math.round(ms / 1000)}s`;
}

export function KafkaTopicCard({ topic, onClick, onProduce, onDelete }: KafkaTopicCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col gap-2 rounded-xl border border-white/5 bg-white/5 p-4 text-left',
        'transition-all duration-200 hover:border-amber-400/30 hover:bg-amber-400/5',
        'focus:outline-none focus:ring-2 focus:ring-amber-400/30',
      )}
    >
      <div className="flex items-center justify-between">
        <Tag size="sm" variant="primary">
          {topic.partitions}p · RF {topic.replicationFactor}
        </Tag>
        <span
          className={cn(
            'h-2 w-2 rounded-full',
            topic.status === 'healthy'
              ? 'bg-emerald-500'
              : topic.status === 'degraded'
                ? 'bg-amber-500'
                : 'bg-red-500',
          )}
        />
      </div>
      <h3 className="truncate font-mono text-sm font-semibold text-neutral-900 dark:text-neutral-50">
        {topic.name}
      </h3>
      <div className="grid grid-cols-3 gap-1 text-[10px] text-neutral-500">
        <div>
          <p>Rate</p>
          <p className="font-mono text-xs text-neutral-300">
            {formatNumber(topic.messagesPerSec)}/s
          </p>
        </div>
        <div>
          <p>Lag</p>
          <p className="font-mono text-xs text-neutral-300">{formatNumber(topic.lag)}</p>
        </div>
        <div>
          <p>Retain</p>
          <p className="font-mono text-xs text-neutral-300">
            {formatRetention(topic.retentionMs)}
          </p>
        </div>
      </div>
      <div className="mt-1 flex items-center justify-between border-t border-white/5 pt-2">
        <Tag size="sm" variant={HEALTH_VARIANT[topic.status]}>
          {topic.status}
        </Tag>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {onProduce !== undefined ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onProduce();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onProduce();
                }
              }}
              className="rounded-md px-2 py-0.5 text-[10px] text-primary-600 hover:bg-white/5 dark:text-primary-400"
            >
              Produce
            </span>
          ) : null}
          {onDelete !== undefined ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete();
                }
              }}
              className="rounded-md px-2 py-0.5 text-[10px] text-red-500 hover:bg-white/5"
            >
              Delete
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}