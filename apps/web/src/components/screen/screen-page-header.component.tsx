import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { GlassCard, Icon, type EIconName } from '@/components';
import { cn } from '@/theme';

export interface ScreenPageHeaderProps {
  iconName: EIconName;
  titleKey: string;
  subtitleKey: string;
  descriptionKey?: string;
  accent: 'primary' | 'bronze' | 'silver' | 'gold' | 'kafka' | 'airflow' | 'dq' | 'crawler' | 'health';
  actions?: ReactNode;
  className?: string;
}

const ACCENT_GLOW: Readonly<Record<ScreenPageHeaderProps['accent'], string>> = {
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

export function ScreenPageHeader({
  iconName,
  titleKey,
  subtitleKey,
  descriptionKey,
  accent,
  actions,
  className,
}: ScreenPageHeaderProps) {
  const { t } = useTranslation();
  return (
    <GlassCard
      elevation={2}
      className={cn('relative flex items-start justify-between gap-4 overflow-hidden p-5', className)}
    >
      <div
        className={cn(
          'pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full opacity-40 blur-3xl',
          'bg-gradient-to-br',
          ACCENT_GLOW[accent],
        )}
      />
      <div className="relative flex items-start gap-4">
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
            'bg-white/10 backdrop-blur-md ring-1 ring-white/20',
          )}
        >
          <Icon name={iconName} size={24} />
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
            {t(subtitleKey)}
          </p>
          <h1 className="mt-0.5 text-2xl font-bold text-neutral-900 dark:text-neutral-50">
            {t(titleKey)}
          </h1>
          {descriptionKey !== undefined ? (
            <p className="mt-1 max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">
              {t(descriptionKey)}
            </p>
          ) : null}
        </div>
      </div>
      {actions !== undefined ? <div className="relative flex shrink-0 items-center gap-2">{actions}</div> : null}
    </GlassCard>
  );
}
