import { Tag } from '@/components';
import { cn } from '@/theme';
import type { BronzeTable } from '@/types/entities';

export interface BronzeTableCardProps {
  table: BronzeTable;
  onClick: () => void;
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

export function BronzeTableCard({ table, onClick }: BronzeTableCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col gap-2 rounded-xl border border-white/5 bg-white/5 p-4 text-left',
        'transition-all duration-200 hover:border-amber-500/30 hover:bg-amber-500/5',
        'focus:outline-none focus:ring-2 focus:ring-amber-500/30',
      )}
    >
      <div className="flex items-center justify-between">
        <Tag size="sm" variant="primary">
          {table.format}
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
      </p>
      <div className="mt-1 flex items-center justify-between border-t border-white/5 pt-2 text-[10px] text-neutral-500">
        <span>{formatNumber(table.rowCount)} rows</span>
        <span>
          {table.lastIngestedAt !== undefined
            ? new Date(table.lastIngestedAt).toLocaleString()
            : '—'}
        </span>
      </div>
    </button>
  );
}
