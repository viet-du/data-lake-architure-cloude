import { useTranslation, Trans } from 'react-i18next';
import { Tag, type ETagVariant } from '@/components';
import type { EHealthStatus } from '@/types/commons';
import type { DQSummary, EDQOutcome } from '@/types/entities';

export interface DQSummaryBarProps {
  summary: DQSummary | undefined;
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

const HEALTH_VARIANT: Readonly<Record<EHealthStatus, ETagVariant>> = {
  unknown: 'warning',
  healthy: 'success',
  degraded: 'warning',
  unhealthy: 'error',
};

/**
 * The quality-gate variants.
 *
 * `not_evaluated` is deliberately a *neutral* tag: it means "no evidence
 * yet", which is neither a success nor a failure (MASTER PLAN §06.1).
 */
const GATE_VARIANT: Readonly<Record<EDQOutcome, ETagVariant>> = {
  pass: 'success',
  fail: 'error',
  warn: 'warning',
  error: 'error',
  not_evaluated: 'neutral',
};

const GATE_LABEL_KEY: Readonly<Record<EDQOutcome, string>> = {
  pass: 'dq.gate.pass',
  fail: 'dq.gate.fail',
  warn: 'dq.gate.warn',
  error: 'dq.gate.error',
  not_evaluated: 'dq.gate.notEvaluated',
};

function formatTime(s: string | undefined): string {
  if (s === undefined) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString();
}

function formatRatio(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

export function DQSummaryBar({
  summary,
  isLoading,
  isError,
  error,
  onRetry,
}: DQSummaryBarProps) {
  const { t } = useTranslation();
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="h-16 animate-pulse rounded-lg bg-white/5" />
        <div className="h-16 animate-pulse rounded-lg bg-white/5" />
        <div className="h-16 animate-pulse rounded-lg bg-white/5" />
        <div className="h-16 animate-pulse rounded-lg bg-white/5" />
      </div>
    );
  }
  if (isError || summary === undefined) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-500">
        {error?.message ?? t('common.error')}
        {onRetry !== undefined ? (
          <button type="button" onClick={onRetry} className="ml-2 underline">
            {t('common.retry')}
          </button>
        ) : null}
      </div>
    );
  }

  const outcome: EDQOutcome = summary.status ?? 'not_evaluated';
  const passRate = summary.passRate;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-white/5 bg-white/5 p-3">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">
            <Trans i18nKey="labels.total_rules" />
          </p>
          <p className="mt-1 text-xl font-bold text-neutral-900 dark:text-neutral-50">
            {summary.totalRules}
          </p>
        </div>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
          <p className="text-[10px] uppercase tracking-wider text-emerald-500">
            <Trans i18nKey="labels.passing" />
          </p>
          <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">
            {summary.passing}
          </p>
        </div>
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
          <p className="text-[10px] uppercase tracking-wider text-red-500">
            <Trans i18nKey="labels.failing" />
          </p>
          <p className="mt-1 text-xl font-bold text-red-600 dark:text-red-400">
            {summary.failing}
          </p>
        </div>
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <p className="text-[10px] uppercase tracking-wider text-amber-500">
            <Trans i18nKey="labels.warning" />
          </p>
          <p className="mt-1 text-xl font-bold text-amber-600 dark:text-amber-400">
            {summary.warning ?? '—'}
          </p>
        </div>
      </div>

      {/* The quality gate + the denominator.
          §06.4: a pass rate without its denominator is meaningless, and
          `null` means "not evaluated" — never a fabricated 0 or 100%. */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/5 bg-white/5 px-3 py-2">
        <Tag size="sm" variant={GATE_VARIANT[outcome]}>
          {t(GATE_LABEL_KEY[outcome])}
        </Tag>
        <Tag size="sm" variant={HEALTH_VARIANT[summary.overallStatus]}>
          {summary.overallStatus}
        </Tag>
        <span className="text-[10px] text-neutral-500">
          {t('dq.gate.description')}
        </span>
        <span className="ml-auto text-[10px] text-neutral-500">
          {t('labels.pass_rate', { defaultValue: 'Pass rate' })}:{' '}
          <span className="font-mono text-neutral-300">
            {passRate === null || passRate === undefined
              ? t('dq.gate.notEvaluated')
              : `${(passRate * 100).toFixed(1)}%`}
          </span>
        </span>
        {summary.evaluatedRows !== undefined ? (
          <span className="text-[10px] text-neutral-500">
            {t('dq.gate.evaluatedRows')}:{' '}
            <span className="font-mono text-neutral-300">
              {summary.evaluatedRows}
            </span>
          </span>
        ) : null}
        {summary.skippedRows !== undefined ? (
          <span className="text-[10px] text-neutral-500">
            {t('dq.gate.skippedRows')}:{' '}
            <span className="font-mono text-neutral-300">
              {summary.skippedRows}
            </span>
          </span>
        ) : null}
        {summary.coverageRate !== undefined && summary.coverageRate !== null ? (
          <span className="text-[10px] text-neutral-500">
            {t('dq.gate.coverage')}:{' '}
            <span className="font-mono text-neutral-300">
              {formatRatio(summary.coverageRate)}
            </span>
          </span>
        ) : null}
        <span className="text-[10px] text-neutral-500">
          Last run: {formatTime(summary.lastRunAt)}
        </span>
      </div>
    </div>
  );
}
