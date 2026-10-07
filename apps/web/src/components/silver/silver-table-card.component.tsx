import { useTranslation } from 'react-i18next';
import { Tag } from '@/components';
import { cn } from '@/theme';
import type { SilverTable } from '@/types/entities';

export interface SilverTableCardProps {
  table: SilverTable;
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

export function SilverTableCard({ table, onClick, onRefresh, refreshing }: SilverTableCardProps) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col gap-2 rounded-xl border border-white/5 bg-white/5 p-4 text-left',
        'transition-all duration-200 hover:border-slate-400/30 hover:bg-slate-400/5',
        'focus:outline-none focus:ring-2 focus:ring-slate-400/30',
      )}
    >
      <div className="flex items-center justify-between">
        <Tag size="sm" variant="info">
          silver
        </Tag>
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
      <p className="text-[10px] text-neutral-500">
        {table.database} · {formatBytes(table.sizeBytes)}
        {table.sourceTable !== undefined ? ` · from ${table.sourceTable}` : ''}
      </p>
      {table.transformRule !== undefined ? (
        <p className="truncate rounded bg-white/5 px-2 py-1 font-mono text-[10px] text-neutral-400">
          {table.transformRule}
        </p>
      ) : null}
      <div className="mt-1 flex items-center justify-between border-t border-white/5 pt-2 text-[10px] text-neutral-500">
        <span>{formatNumber(table.rowCount)} rows</span>
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
            {refreshing === true ? '...' : `${t('screens.silver.refresh')} →`}
          </span>
        ) : null}
      </div>
    </button>
  );
}
