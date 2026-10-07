import { type FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Icon, ProgressBar, Tag } from '@/components';
import { cn } from '@/theme';
import type { EHealthStatus } from '@/types/commons';
import type { HomeModuleItem } from './home.types';

const ACCENT_GRADIENT: Readonly<Record<HomeModuleItem['accent'], string>> = {
  primary: 'from-primary-500/30 to-cyan-500/20',
  bronze: 'from-amber-500/30 to-orange-500/20',
  silver: 'from-slate-400/30 to-zinc-500/20',
  gold: 'from-yellow-400/30 to-amber-500/20',
  kafka: 'from-rose-500/30 to-pink-500/20',
  airflow: 'from-sky-500/30 to-blue-500/20',
  dq: 'from-emerald-500/30 to-teal-500/20',
  crawler: 'from-violet-500/30 to-purple-500/20',
  health: 'from-green-500/30 to-emerald-500/20',
};

const ACCENT_RING: Readonly<Record<HomeModuleItem['accent'], string>> = {
  primary: 'group-hover:ring-primary-500/50',
  bronze: 'group-hover:ring-amber-500/50',
  silver: 'group-hover:ring-slate-400/50',
  gold: 'group-hover:ring-yellow-400/50',
  kafka: 'group-hover:ring-rose-500/50',
  airflow: 'group-hover:ring-sky-500/50',
  dq: 'group-hover:ring-emerald-500/50',
  crawler: 'group-hover:ring-violet-500/50',
  health: 'group-hover:ring-green-500/50',
};

const STATUS_TAG: Readonly<Record<EHealthStatus, { variant: 'success' | 'warning' | 'error'; labelKey: string }>> = {
  healthy: { variant: 'success', labelKey: 'home.active' },
  degraded: { variant: 'warning', labelKey: 'health.degraded' },
  unhealthy: { variant: 'error', labelKey: 'home.inactive' },
};

const BAR_VARIANT: Readonly<Record<HomeModuleItem['accent'], 'primary' | 'bronze' | 'silver' | 'gold' | 'kafka' | 'airflow' | 'dq' | 'crawler' | 'health'>> = {
  primary: 'primary',
  bronze: 'bronze',
  silver: 'silver',
  gold: 'gold',
  kafka: 'kafka',
  airflow: 'airflow',
  dq: 'dq',
  crawler: 'crawler',
  health: 'health',
};

interface MiniSparklineProps {
  data: ReadonlyArray<number>;
  className?: string;
}

const MiniSparkline: FC<MiniSparklineProps> = ({ data, className }) => {
  const sampled = useMemo(() => {
    if (data.length <= 7) return data;
    const step = Math.max(1, Math.floor(data.length / 7));
    const result: number[] = [];
    for (let i = 0; i < data.length && result.length < 7; i += step) {
      const value = data[i];
      if (value !== undefined) result.push(value);
    }
    const last = data[data.length - 1];
    if (last !== undefined && result[result.length - 1] !== last) result.push(last);
    return result;
  }, [data]);

  const max = useMemo(() => Math.max(...sampled, 1), [sampled]);
  const min = useMemo(() => Math.min(...sampled, 0), [sampled]);
  const range = Math.max(1, max - min);

  return (
    <div
      className={cn('flex h-6 items-end gap-1', className)}
      role="img"
      aria-label={`Trend ${sampled.join(',')}`}
    >
      {sampled.map((value, idx) => {
        const ratio = (value - min) / range;
        const height = 25 + ratio * 75;
        const isLast = idx === sampled.length - 1;
        return (
          <span
            key={`${idx}-${value}`}
            className={cn(
              'flex-1 rounded-sm transition-all duration-300',
              isLast ? 'bg-primary-400' : 'bg-white/30',
            )}
            style={{ height: `${height}%` }}
          />
        );
      })}
    </div>
  );
};

export interface ModuleCardProps {
  module: HomeModuleItem;
}

export function ModuleCard({ module: mod }: ModuleCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const statusInfo = STATUS_TAG[mod.status];
  const hasProgress = mod.progress !== undefined;
  const hasSparkline = mod.sparkline !== undefined && mod.sparkline.length > 0;

  return (
    <button
      type="button"
      onClick={() => navigate(mod.path)}
      className={cn(
        'group relative flex h-full w-full overflow-hidden rounded-2xl text-left',
        'border border-white/10 backdrop-blur-xl transition-all duration-300',
        'bg-white/5 hover:bg-white/10',
        'hover:-translate-y-0.5 hover:shadow-2xl',
        'ring-1 ring-transparent',
        ACCENT_RING[mod.accent],
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
      )}
    >
      <div
        className={cn(
          'pointer-events-none absolute inset-0 bg-gradient-to-br opacity-50 transition-opacity duration-300',
          'group-hover:opacity-80',
          ACCENT_GRADIENT[mod.accent],
        )}
      />
      <div className="relative flex w-full flex-col justify-between gap-3 p-4">
        <div className="flex items-start justify-between">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl',
              'bg-white/10 backdrop-blur-md ring-1 ring-white/20',
            )}
          >
            <Icon name={mod.iconName} size={22} />
          </div>
          <Tag variant={statusInfo.variant} dot size="sm">
            {t(statusInfo.labelKey)}
          </Tag>
        </div>

        <div>
          <p className="text-[10px] font-medium uppercase tracking-widest text-black dark:text-white">
            {t(mod.categoryKey)}
          </p>
          <h3 className="mt-1 text-base font-semibold text-black dark:text-white">
            {t(mod.titleKey)}
          </h3>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-black dark:text-white">
            {t(mod.descriptionKey)}
          </p>
        </div>

        {hasProgress ? (
          <ProgressBar
            value={mod.progress ?? 0}
            variant={BAR_VARIANT[mod.accent]}
            size="sm"
            className="mt-1"
          />
        ) : null}

        <div className="mt-1 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-black dark:text-white">{mod.metric}</p>
            <p className="text-[10px] text-black dark:text-white">{t(mod.metricLabelKey)}</p>
          </div>
          {hasSparkline ? (
            <div className="w-20 shrink-0">
              <MiniSparkline data={mod.sparkline ?? []} />
            </div>
          ) : (
            <span
              className={cn(
                'inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium',
                'bg-white/10 text-black dark:text-white backdrop-blur-sm',
                'transition-transform duration-300 group-hover:translate-x-0.5',
              )}
            >
              {t('home.open_module')}
              <span aria-hidden="true">→</span>
            </span>
          )}
        </div>

        {hasSparkline ? (
          <span
            className={cn(
              'inline-flex h-7 w-fit items-center gap-1 self-end rounded-md px-2 text-xs font-medium',
              'bg-white/10 text-black dark:text-white backdrop-blur-sm',
              'transition-transform duration-300 group-hover:translate-x-0.5',
            )}
          >
            {t('home.open_module')}
            <span aria-hidden="true">→</span>
          </span>
        ) : null}
      </div>
    </button>
  );
}