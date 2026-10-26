import { useTranslation } from 'react-i18next';
import { Tag, type ETagVariant } from '@/components';
import { cn } from '@/theme';
import type { EColumnProfile, ELogicalType } from '@/types/entities';
import { formatCount, formatNumber, formatRatio } from './eda.helpers';

/**
 * The column profile card.
 *
 * The card is the atom of the profile library: it shows one column's
 * measured statistics and — crucially — states when a statistic was *not*
 * measured. A missing `distinctCount` renders as `—`, not as `0`.
 */

export const LOGICAL_TYPE_VARIANT: Readonly<Record<ELogicalType, ETagVariant>> = {
  numeric: 'info',
  categorical: 'primary',
  boolean: 'neutral',
  datetime: 'warning',
  text: 'neutral',
  complex: 'neutral',
};

export interface EdaColumnCardProps {
  column: EColumnProfile;
  /** The share of the column that is missing, in 0–1. */
  missingRatio: number;
  onClick?: () => void;
  onProposeRule?: () => void;
  selected?: boolean;
  className?: string;
}

function numericOrNull(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function EdaColumnCard({
  column,
  missingRatio,
  onClick,
  onProposeRule,
  selected = false,
  className,
}: EdaColumnCardProps) {
  const { t } = useTranslation();
  const isNumeric = column.logicalType === 'numeric';

  return (
    <div
      onClick={onClick}
      role={onClick !== undefined ? 'button' : undefined}
      tabIndex={onClick !== undefined ? 0 : undefined}
      onKeyDown={(event) => {
        if (onClick === undefined) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      className={cn(
        'flex flex-col gap-2 rounded-xl border p-3 text-left transition-all duration-200',
        selected
          ? 'border-primary-500/50 bg-primary-500/10'
          : 'border-white/5 bg-white/5 hover:border-white/20 hover:bg-white/10',
        onClick !== undefined ? 'cursor-pointer' : '',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-mono text-xs font-semibold text-neutral-900 dark:text-neutral-50">
            {column.name}
          </p>
          {column.physicalType !== undefined ? (
            <p className="truncate text-[10px] text-neutral-500">{column.physicalType}</p>
          ) : null}
        </div>
        <Tag size="sm" variant={LOGICAL_TYPE_VARIANT[column.logicalType]}>
          {column.logicalType}
        </Tag>
      </div>

      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
          <div
            className={cn(
              'h-full rounded-full',
              missingRatio > 0.5
                ? 'bg-red-500/70'
                : missingRatio > 0.1
                  ? 'bg-amber-500/70'
                  : 'bg-emerald-500/70',
            )}
            style={{ width: `${Math.min(100, missingRatio * 100)}%` }}
          />
        </div>
        <span className="font-mono text-[10px] text-neutral-500">
          {t('eda.column.missingPct', { value: (missingRatio * 100).toFixed(1) })}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
        <div className="flex justify-between">
          <dt className="text-neutral-500">{t('eda.column.nulls')}</dt>
          <dd className="font-mono text-neutral-700 dark:text-neutral-300">
            {formatCount(column.nullCount)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-neutral-500">{t('eda.column.nonNulls')}</dt>
          <dd className="font-mono text-neutral-700 dark:text-neutral-300">
            {formatCount(column.nonNullCount)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-neutral-500">{t('eda.column.distinct')}</dt>
          <dd className="font-mono text-neutral-700 dark:text-neutral-300">
            {column.distinctCount === undefined
              ? '—'
              : `${formatCount(column.distinctCount)}${column.distinctApprox === true ? '≈' : ''}`}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-neutral-500">{t('eda.column.cardinality')}</dt>
          <dd className="font-mono text-neutral-700 dark:text-neutral-300">
            {formatRatio(column.cardinalityRatio)}
          </dd>
        </div>
        {isNumeric ? (
          <>
            <div className="flex justify-between">
              <dt className="text-neutral-500">{t('eda.column.mean')}</dt>
              <dd className="font-mono text-neutral-700 dark:text-neutral-300">
                {formatNumber(column.mean)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">{t('eda.column.std')}</dt>
              <dd className="font-mono text-neutral-700 dark:text-neutral-300">
                {formatNumber(column.std)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">{t('eda.column.median')}</dt>
              <dd className="font-mono text-neutral-700 dark:text-neutral-300">
                {formatNumber(column.median)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">{t('eda.column.iqr')}</dt>
              <dd className="font-mono text-neutral-700 dark:text-neutral-300">
                {formatNumber(column.iqr)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">{t('eda.column.min')}</dt>
              <dd className="font-mono text-neutral-700 dark:text-neutral-300">
                {formatNumber(numericOrNull(column.min))}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">{t('eda.column.max')}</dt>
              <dd className="font-mono text-neutral-700 dark:text-neutral-300">
                {formatNumber(numericOrNull(column.max))}
              </dd>
            </div>
          </>
        ) : null}
      </dl>

      {column.topValues !== undefined && column.topValues.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {column.topValues.slice(0, 4).map((entry) => (
            <span
              key={entry.value}
              className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-neutral-500"
              title={`${entry.value}: ${entry.count}`}
            >
              {entry.value.length > 14 ? `${entry.value.slice(0, 13)}…` : entry.value}
            </span>
          ))}
        </div>
      ) : null}

      {onProposeRule !== undefined ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onProposeRule();
          }}
          className="self-start rounded-md px-2 py-1 text-[10px] font-medium text-primary-600 transition-colors hover:bg-white/10 dark:text-primary-300"
        >
          {t('eda.proposeRule')}
        </button>
      ) : null}
    </div>
  );
}
