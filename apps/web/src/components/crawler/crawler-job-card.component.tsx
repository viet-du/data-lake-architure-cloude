import { Tag, type ETagVariant } from '@/components';
import { cn } from '@/theme';
import type { CrawlerJob } from '@/types/entities';

export interface CrawlerJobCardProps {
  job: CrawlerJob;
  onClick: () => void;
  onRun?: () => void;
  onStop?: () => void;
  running?: boolean;
}

const STATUS_VARIANT: Readonly<Record<string, ETagVariant>> = {
  running: 'info',
  paused: 'warning',
  idle: 'neutral',
  completed: 'success',
  failed: 'error',
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function CrawlerJobCard({
  job,
  onClick,
  onRun,
  onStop,
  running,
}: CrawlerJobCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col gap-2 rounded-xl border border-white/5 bg-white/5 p-4 text-left',
        'transition-all duration-200 hover:border-rose-400/30 hover:bg-rose-400/5',
        'focus:outline-none focus:ring-2 focus:ring-rose-400/30',
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Tag size="sm" variant="primary">
            {job.source}
          </Tag>
          <Tag size="sm" variant="neutral">
            {job.category}
          </Tag>
        </div>
        <span
          className={cn(
            'h-2 w-2 rounded-full',
            job.health === 'healthy' ? 'bg-emerald-500' : 'bg-amber-500',
          )}
        />
      </div>
      <h3 className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-50">
        {job.name}
      </h3>
      <p className="text-[10px] text-neutral-500">
        {formatNumber(job.recordsCollected)} collected · {formatNumber(job.pagesScraped)} pages
      </p>
      <div className="mt-1 flex items-center justify-between border-t border-white/5 pt-2">
        <Tag size="sm" variant={STATUS_VARIANT[job.status] ?? 'neutral'}>
          {job.status}
        </Tag>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {onRun !== undefined ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onRun();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onRun();
                }
              }}
              className="rounded-md px-2 py-0.5 text-[10px] text-primary-600 hover:bg-white/5 dark:text-primary-400"
            >
              {running === true ? '...' : 'Run'}
            </span>
          ) : null}
          {onStop !== undefined ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onStop();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onStop();
                }
              }}
              className="rounded-md px-2 py-0.5 text-[10px] text-red-500 hover:bg-white/5"
            >
              Stop
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}