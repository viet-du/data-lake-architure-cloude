import { Tag, type ETagVariant } from '@/components';
import { cn } from '@/theme';
import type { DQRule, EDQSeverity, EDQStatus } from '@/types/entities';

export interface DQRuleCardProps {
  rule: DQRule;
  onClick: () => void;
  onRun?: () => void;
  onToggle?: () => void;
}

const STATUS_VARIANT: Readonly<Record<EDQStatus, ETagVariant>> = {
  pass: 'success',
  fail: 'error',
  warning: 'warning',
};

const SEVERITY_VARIANT: Readonly<Record<EDQSeverity, ETagVariant>> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  critical: 'error',
};

function formatTime(s: string | undefined): string {
  if (s === undefined) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString();
}

export function DQRuleCard({ rule, onClick, onRun, onToggle }: DQRuleCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col gap-2 rounded-xl border border-white/5 bg-white/5 p-4 text-left',
        'transition-all duration-200 hover:border-pink-400/30 hover:bg-pink-400/5',
        'focus:outline-none focus:ring-2 focus:ring-pink-400/30',
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Tag size="sm" variant={SEVERITY_VARIANT[rule.severity]}>
            {rule.severity}
          </Tag>
          <Tag size="sm" variant="info">
            {rule.ruleType}
          </Tag>
        </div>
        <Tag size="sm" variant={STATUS_VARIANT[rule.status]}>
          {rule.status}
        </Tag>
      </div>
      <h3 className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-50">
        {rule.ruleName}
      </h3>
      <p className="truncate font-mono text-[10px] text-neutral-500">{rule.tableName}</p>
      {rule.description !== undefined ? (
        <p className="line-clamp-2 text-[10px] text-neutral-500">{rule.description}</p>
      ) : null}
      <div className="grid grid-cols-2 gap-1 text-[10px] text-neutral-500">
        <div>
          <p>Last run</p>
          <p className="font-mono text-[10px] text-neutral-300">{formatTime(rule.lastRunAt)}</p>
        </div>
        <div>
          <p>Failed rows</p>
          <p className="font-mono text-xs text-neutral-300">
            {rule.failedRows === undefined ? '—' : rule.failedRows}
            {rule.totalRows !== undefined ? ` / ${rule.totalRows}` : ''}
          </p>
        </div>
      </div>
      <div className="mt-1 flex items-center justify-between border-t border-white/5 pt-2">
        <span className="text-[10px] text-neutral-500">
          {rule.enabled ? 'enabled' : 'disabled'}
        </span>
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
              Run
            </span>
          ) : null}
          {onToggle !== undefined ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggle();
                }
              }}
              className="rounded-md px-2 py-0.5 text-[10px] text-amber-500 hover:bg-white/5"
            >
              {rule.enabled ? 'Disable' : 'Enable'}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}