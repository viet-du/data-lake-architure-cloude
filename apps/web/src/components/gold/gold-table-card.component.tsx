import { useTranslation } from 'react-i18next';
import { Tag } from '@/components';
import { cn } from '@/theme';
import type { GoldTable } from '@/types/entities';

export interface GoldTableCardProps {
  table: GoldTable;
  onClick: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatBytes(n: number): string {
  if (n >= 1_073_741_824) return `${(n / 1_073_741_824).toFixed(2)} GB`;
  if (n >= 1_048_576) return `${(n / 1_048_576).toFixed(2)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(2)} KB`;
  return `${n} B`;
}

export function GoldTableCard({ table, onClick, onRefresh, refreshing }: GoldTableCardProps) {
  const { t } = useTranslation();
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
        <div className="flex items-center gap-1">
          <Tag size="sm" variant="warning">
            {table.aggregateType ?? 'group_by'}
          </Tag>
          <Tag size="sm" variant="neutral">
            {table.sourceLayer}
          </Tag>
        </div>
        <span
          className={cn(
            'h-2 w-2 rounded-full',
            table.status === 'healthy' ? 'bg-emerald-500' : 'bg-amber-500',
          )}
        />
      </div>
      <h3 className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-50">
        {table.name}
      </h3>
      <p className="truncate text-[10px] text-neutral-500">
        from {table.sourceTables.slice(0, 2).join(', ')}
        {table.sourceTables.length > 2 ? ` +${table.sourceTables.length - 2}` : ''}
      </p>
      <div className="mt-1 flex items-center justify-between border-t border-white/5 pt-2 text-[10px] text-neutral-500">
        <span>
          {formatNumber(table.rowCount)} rows · {formatBytes(table.sizeBytes)}
        </span>
        {onRefresh !== undefined ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onRefresh();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onRefresh();
              }
            }}
            className="text-primary-600 dark:text-primary-400 hover:underline"
          >
            {refreshing === true ? '...' : `${t('screens.gold.refresh')} →`}
          </span>
        ) : null}
      </div>
    </button>
  );
}