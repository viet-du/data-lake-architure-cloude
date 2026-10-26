import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState, Tag } from '@/components/common';
import { SearchInput } from '@/components/form';
import { cn } from '@/theme';
import type { DQRule, EDQSeverity } from '@/types/entities';

/**
 * The rule picker.
 *
 * The suite runner used to ask for rule ids in a free-text textarea. That
 * meant the user had to know the UUID of every rule they wanted to run —
 * information that exists nowhere in the UI. The suite form was therefore
 * unusable without opening the database.
 *
 * This picker lists the rules with the information the user actually has
 * (name, dataset, column, type, severity) and turns a click into a
 * selection. The ids stay an implementation detail: the component reports
 * the selected ids to the caller, but the user never sees or types them.
 */

const SEVERITY_VARIANT: Readonly<Record<EDQSeverity, 'neutral' | 'info' | 'warning' | 'error'>> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  critical: 'error',
};

export interface RulePickerProps {
  /** Every rule the user may pick from. */
  rules: ReadonlyArray<DQRule> | undefined;
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  onRetry?: () => void;
  /** The ids of the currently selected rules. */
  selectedIds: ReadonlyArray<string>;
  /** Called with the new selection whenever the user picks or unpicks. */
  onChange: (ids: ReadonlyArray<string>) => void;
  /** Restrict the list to the rules of this dataset. */
  tableFilter?: string | null;
  className?: string;
}

export function RulePicker({
  rules,
  isLoading,
  isError,
  error,
  onRetry,
  selectedIds,
  onChange,
  tableFilter = null,
  className,
}: RulePickerProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    const all = rules ?? [];
    const needle = search.trim().toLowerCase();
    return all.filter((rule) => {
      if (tableFilter !== null && tableFilter !== '') {
        const table = rule.tableName.toLowerCase();
        if (!table.includes(tableFilter.toLowerCase())) return false;
      }
      if (needle === '') return true;
      return (
        rule.ruleName.toLowerCase().includes(needle) ||
        rule.tableName.toLowerCase().includes(needle) ||
        (rule.columnName ?? '').toLowerCase().includes(needle) ||
        rule.ruleType.toLowerCase().includes(needle)
      );
    });
  }, [rules, search, tableFilter]);

  function toggle(ruleId: string): void {
    if (selectedIds.includes(ruleId)) {
      onChange(selectedIds.filter((id) => id !== ruleId));
      return;
    }
    onChange([...selectedIds, ruleId]);
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1.5">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-12 animate-pulse rounded-lg bg-white/5" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-[11px] text-red-500">
        {error?.message ?? t('common.error')}
        {onRetry !== undefined ? (
          <button type="button" onClick={onRetry} className="ml-2 underline">
            {t('common.retry')}
          </button>
        ) : null}
      </div>
    );
  }

  if ((rules ?? []).length === 0) {
    return <EmptyState compact title={t('rulePicker.noRules')} />;
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t('rulePicker.search')}
          className="w-full"
        />
        <span className="shrink-0 text-[10px] text-neutral-500">
          {t('rulePicker.selected', { count: selectedIds.length })}
        </span>
      </div>

      {visible.length === 0 ? (
        <EmptyState compact title={t('rulePicker.noMatch')} />
      ) : (
        <div className="flex max-h-64 flex-col gap-1 overflow-y-auto pr-1">
          {visible.map((rule) => {
            const active = selectedIds.includes(rule.ruleId);
            return (
              <button
                key={rule.ruleId}
                type="button"
                onClick={() => toggle(rule.ruleId)}
                aria-pressed={active}
                className={cn(
                  'flex items-start gap-2 rounded-lg border p-2 text-left transition-colors',
                  active
                    ? 'border-primary-500/50 bg-primary-500/10'
                    : 'border-white/5 bg-white/5 hover:bg-white/10',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[9px]',
                    active
                      ? 'border-primary-500 bg-primary-500/30 text-primary-300'
                      : 'border-white/20 text-transparent',
                  )}
                >
                  ✓
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] font-medium text-neutral-800 dark:text-neutral-100">
                      {rule.ruleName}
                    </span>
                    <Tag size="sm" variant={SEVERITY_VARIANT[rule.severity]}>
                      {rule.severity}
                    </Tag>
                  </span>
                  <span className="truncate font-mono text-[9px] text-neutral-500">
                    {rule.tableName}
                    {rule.columnName !== undefined && rule.columnName !== ''
                      ? `.${rule.columnName}`
                      : ''}
                    {' · '}
                    {rule.ruleType}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
