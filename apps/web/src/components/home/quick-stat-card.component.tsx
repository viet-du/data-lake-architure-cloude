import { useTranslation, Trans } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { GlassCard, Tag } from '@/components';
import { cn } from '@/theme';
import { useCountUp, useReducedMotion } from '@/hooks';
import type { HomeQuickStat } from './home.types';

const ACCENT_GRADIENT: Readonly<Record<HomeQuickStat['accent'], string>> = {
  primary: 'from-primary-500/20 to-cyan-500/20',
  bronze: 'from-amber-500/20 to-orange-500/20',
  silver: 'from-slate-400/20 to-zinc-500/20',
  gold: 'from-yellow-400/20 to-amber-500/20',
  kafka: 'from-rose-500/20 to-pink-500/20',
  airflow: 'from-sky-500/20 to-blue-500/20',
  dq: 'from-emerald-500/20 to-teal-500/20',
  crawler: 'from-violet-500/20 to-purple-500/20',
  health: 'from-green-500/20 to-emerald-500/20',
};

const ACCENT_RING: Readonly<Record<HomeQuickStat['accent'], string>> = {
  primary: 'ring-primary-500/30',
  bronze: 'ring-amber-500/30',
  silver: 'ring-slate-400/30',
  gold: 'ring-yellow-400/30',
  kafka: 'ring-rose-500/30',
  airflow: 'ring-sky-500/30',
  dq: 'ring-emerald-500/30',
  crawler: 'ring-violet-500/30',
  health: 'ring-green-500/30',
};

const NUMERIC_PATTERN = /^-?\d+(\.\d+)?$/;

function parseNumeric(value: string): { numeric: number | null; suffix: string; prefix: string } {
  const match = value.match(/^([^0-9-]*)(-?\d+(?:\.\d+)?)(.*)$/);
  if (match === null) return { numeric: null, suffix: '', prefix: '' };
  const prefix = match[1] ?? '';
  const numericPart = match[2] ?? '';
  const suffix = match[3] ?? '';
  if (!NUMERIC_PATTERN.test(numericPart)) return { numeric: null, suffix, prefix };
  return { numeric: Number(numericPart), suffix, prefix };
}

function formatNumber(value: number, suffix: string, prefix: string, integer: boolean): string {
  const isInteger = integer;
  const rounded = isInteger ? Math.round(value).toString() : value.toFixed(1);
  return `${prefix}${rounded}${suffix}`;
}

export interface QuickStatCardProps {
  stat: HomeQuickStat;
}

/**
 * The badge that tells a degraded measurement apart from a good one.
 *
 * MASTER PLAN §08 requires the empty/unavailable/stale states to be
 * reflected correctly, and §08.1 requires a stale value to be labelled as
 * stale — never presented as a live reading. The three states are
 * distinct:
 *
 *  * `stale` — a real last-known value that is too old to be current;
 *  * `unavailable` — the source could not be read at all;
 *  * `not_evaluated` — there never was any evidence.
 */
const STATUS_BADGE: Readonly<
  Record<HomeQuickStat['status'], { variant: 'success' | 'warning' | 'error' | 'info'; labelKey: string } | null>
> = {
  ok: null,
  stale: { variant: 'warning', labelKey: 'home.metric_status.stale' },
  unavailable: { variant: 'error', labelKey: 'home.metric_status.unavailable' },
  not_evaluated: { variant: 'info', labelKey: 'home.metric_status.not_evaluated' },
};

export function QuickStatCard({ stat }: QuickStatCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const parsed = parseNumeric(stat.value);
  const target = parsed.numeric ?? 0;
  const animated = useCountUp(target, { enabled: parsed.numeric !== null && !reducedMotion });
  const display = parsed.numeric === null ? stat.value : formatNumber(animated, parsed.suffix, parsed.prefix, Number.isInteger(target));
  const badge = STATUS_BADGE[stat.status];

  return (
    <GlassCard
      elevation={3}
      hoverable
      tilt
      tiltIntensity={4}
      className={cn(
        'relative flex h-full flex-col justify-between p-4',
        ACCENT_RING[stat.accent],
      )}
    >
      <div
        className={cn(
          'pointer-events-none absolute inset-0 bg-gradient-to-br opacity-30',
          ACCENT_GRADIENT[stat.accent],
        )}
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wider text-black dark:text-white">
            {t(stat.labelKey)}
          </p>
          {badge ? (
            <Tag variant={badge.variant} size="sm">
              {t(badge.labelKey)}
            </Tag>
          ) : null}
        </div>
        <p data-stat={stat.key} data-target={stat.value} className="mt-2 text-3xl font-bold text-black dark:text-white tabular-nums">
          {display}
        </p>
        {stat.window !== undefined && stat.status === 'ok' ? (
          <p className="mt-1 text-[10px] text-black dark:text-white">
            {t('home.quality_window.applied', { window: stat.window })}
          </p>
        ) : null}
      </div>
      {stat.action !== undefined ? (
        <button
          type="button"
          onClick={() => navigate(stat.action!.path)}
          className="relative mt-2 self-start text-xs font-semibold text-primary-700 underline underline-offset-2 hover:text-primary-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 dark:text-primary-300 dark:hover:text-primary-100"
        >
          {t(stat.action.labelKey)}
        </button>
      ) : null}
      {stat.delta !== undefined ? (
        <div className="relative mt-2 flex items-center gap-1 text-xs">
          <span
            className={cn(
              'font-semibold',
              stat.delta >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400',
            )}
          >
            {stat.delta >= 0 ? '+' : ''}{stat.delta}%
          </span>
          <span className="text-black dark:text-white"><Trans i18nKey="labels.vs_24h" /></span>
        </div>
      ) : null}
    </GlassCard>
  );
}