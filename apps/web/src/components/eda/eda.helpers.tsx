import { useTranslation } from 'react-i18next';
import type { ETagVariant } from '@/components';
import { cn } from '@/theme';
import type { EProfileStatus } from '@/types/entities';

/**
 * The shared EDA display helpers.
 *
 * Two rules are encoded here rather than repeated in every component:
 *
 *  * a count is a **string** — it is formatted with `Intl` on the string
 *    itself so a value beyond `Number.MAX_SAFE_INTEGER` is not mangled;
 *  * a missing measurement is `undefined` and renders as `—`, never `0`.
 */

export function formatCount(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const text = String(value);
  if (!/^-?\d+$/.test(text)) return text;
  try {
    return BigInt(text).toLocaleString();
  } catch {
    return text;
  }
}

export function formatRatio(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function formatPercentValue(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toFixed(digits)}%`;
}

export function formatTime(value: string | undefined): string {
  if (value === undefined) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export const PROFILE_STATUS_VARIANT: Readonly<Record<EProfileStatus, ETagVariant>> = {
  queued: 'neutral',
  running: 'info',
  succeeded: 'success',
  partial: 'warning',
  failed: 'error',
};

export const PROFILE_STATUS_LABEL_KEY: Readonly<Record<EProfileStatus, string>> = {
  queued: 'eda.status.queued',
  running: 'eda.status.running',
  succeeded: 'eda.status.succeeded',
  partial: 'eda.status.partial',
  failed: 'eda.status.failed',
};

/** A labelled metric tile — the read-model unit of every EDA panel. */
export function MetricTile({
  label,
  value,
  hint,
  tone = 'neutral',
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'neutral' | 'success' | 'warning' | 'error' | 'info';
  className?: string;
}) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
      : tone === 'warning'
        ? 'border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400'
        : tone === 'error'
          ? 'border-red-500/20 bg-red-500/5 text-red-600 dark:text-red-400'
          : tone === 'info'
            ? 'border-sky-500/20 bg-sky-500/5 text-sky-600 dark:text-sky-400'
            : 'border-white/5 bg-white/5 text-neutral-800 dark:text-neutral-100';

  return (
    <div className={cn('rounded-lg border p-3', toneClass, className)}>
      <p className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-1 font-mono text-sm font-bold">{value}</p>
      {hint !== undefined ? (
        <p className="mt-0.5 truncate text-[10px] text-neutral-500">{hint}</p>
      ) : null}
    </div>
  );
}

/** The label of a profile status, translated. */
export function useProfileStatusLabel(): (status: EProfileStatus) => string {
  const { t } = useTranslation();
  return (status: EProfileStatus) => t(PROFILE_STATUS_LABEL_KEY[status]);
}
