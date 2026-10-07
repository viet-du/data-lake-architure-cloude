import { Tag, type ETagVariant } from '@/components';
import { cn } from '@/theme';
import type { AirflowDAG, EDagState } from '@/types/entities';
import type { EHealthStatus } from '@/types/commons';

export interface AirflowDAGCardProps {
  dag: AirflowDAG;
  onClick: () => void;
  onTrigger?: () => void;
  onTogglePause?: () => void;
}

const HEALTH_VARIANT: Readonly<Record<EHealthStatus, ETagVariant>> = {
  healthy: 'success',
  degraded: 'warning',
  unhealthy: 'error',
};

const STATE_VARIANT: Readonly<Record<EDagState, ETagVariant>> = {
  success: 'success',
  failed: 'error',
  running: 'info',
  queued: 'warning',
};

function formatTime(s: string | undefined): string {
  if (s === undefined) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString();
}

export function AirflowDAGCard({
  dag,
  onClick,
  onTrigger,
  onTogglePause,
}: AirflowDAGCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col gap-2 rounded-xl border border-white/5 bg-white/5 p-4 text-left',
        'transition-all duration-200 hover:border-violet-400/30 hover:bg-violet-400/5',
        'focus:outline-none focus:ring-2 focus:ring-violet-400/30',
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Tag size="sm" variant={dag.isPaused ? 'neutral' : 'primary'}>
            {dag.isPaused ? 'paused' : 'active'}
          </Tag>
          <Tag size="sm" variant={HEALTH_VARIANT[dag.status]}>
            {dag.status}
          </Tag>
        </div>
        {dag.lastRunState !== undefined ? (
          <Tag size="sm" variant={STATE_VARIANT[dag.lastRunState]}>
            {dag.lastRunState}
          </Tag>
        ) : null}
      </div>
      <h3 className="truncate font-mono text-sm font-semibold text-neutral-900 dark:text-neutral-50">
        {dag.dagId}
      </h3>
      {dag.description !== undefined ? (
        <p className="line-clamp-2 text-[10px] text-neutral-500">{dag.description}</p>
      ) : null}
      <div className="grid grid-cols-2 gap-1 text-[10px] text-neutral-500">
        <div>
          <p>Schedule</p>
          <p className="font-mono text-xs text-neutral-300">
            {dag.scheduleInterval ?? '—'}
          </p>
        </div>
        <div>
          <p>Tags</p>
          <p className="truncate font-mono text-xs text-neutral-300">
            {dag.tags.length === 0 ? '—' : dag.tags.join(', ')}
          </p>
        </div>
        <div>
          <p>Last run</p>
          <p className="font-mono text-[10px] text-neutral-300">{formatTime(dag.lastRunAt)}</p>
        </div>
        <div>
          <p>Next run</p>
          <p className="font-mono text-[10px] text-neutral-300">{formatTime(dag.nextRunAt)}</p>
        </div>
      </div>
      <div className="mt-1 flex items-center justify-between border-t border-white/5 pt-2">
        <span className="text-[10px] text-neutral-500">
          {dag.tags.length} tag{dag.tags.length === 1 ? '' : 's'}
        </span>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {onTrigger !== undefined ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onTrigger();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onTrigger();
                }
              }}
              className="rounded-md px-2 py-0.5 text-[10px] text-primary-600 hover:bg-white/5 dark:text-primary-400"
            >
              Trigger
            </span>
          ) : null}
          {onTogglePause !== undefined ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onTogglePause();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onTogglePause();
                }
              }}
              className={cn(
                'rounded-md px-2 py-0.5 text-[10px] hover:bg-white/5',
                dag.isPaused ? 'text-emerald-500' : 'text-amber-500',
              )}
            >
              {dag.isPaused ? 'Unpause' : 'Pause'}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}