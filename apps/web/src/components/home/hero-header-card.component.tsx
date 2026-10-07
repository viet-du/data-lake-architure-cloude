import { useTranslation } from 'react-i18next';
import { GlassCard, Tag, Icon, type EIconName } from '@/components';
import { useThemeStore } from '@/store';
import { cn } from '@/theme';

export interface HeroHeaderCardProps {
  appName: string;
  tagline: string;
  systemStatus: 'healthy' | 'degraded' | 'unhealthy';
  uptimeSeconds: number;
  iconName?: EIconName;
}

const STATUS_MAP: Readonly<Record<'healthy' | 'degraded' | 'unhealthy', { variant: 'success' | 'warning' | 'error'; labelKey: string }>> = {
  healthy: { variant: 'success', labelKey: 'home.live' },
  degraded: { variant: 'warning', labelKey: 'health.degraded' },
  unhealthy: { variant: 'error', labelKey: 'health.unhealthy' },
};

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

export function HeroHeaderCard({ appName, tagline, systemStatus, uptimeSeconds, iconName }: HeroHeaderCardProps) {
  const { t } = useTranslation();
  const resolvedMode = useThemeStore((s) => s.resolvedMode);
  const isDark = resolvedMode === 'dark';
  const statusInfo = STATUS_MAP[systemStatus];

  return (
    <GlassCard
      elevation={3}
      className={cn(
        'flex h-full min-h-[260px] flex-col justify-between p-6',
        'overflow-hidden',
      )}
    >
      <div
        className={cn(
          'pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full opacity-40 blur-3xl',
          isDark ? 'bg-primary-500/30' : 'bg-primary-400/30',
        )}
      />
      <div
        className={cn(
          'pointer-events-none absolute -bottom-16 -left-8 h-48 w-48 rounded-full opacity-30 blur-3xl',
          isDark ? 'bg-cyan-500/20' : 'bg-cyan-400/20',
        )}
      />

      <div className="relative flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-xl',
              'bg-gradient-to-br from-primary-500 to-cyan-500 shadow-lg shadow-primary-500/30',
            )}
          >
            <Icon name={iconName ?? 'Cloud'} size={26} alt={appName} />
          </div>
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-black dark:text-white">
              {t('home.greeting')}
            </p>
            <h1 className="mt-0.5 text-3xl font-bold text-black dark:text-white md:text-4xl">
              {appName}
            </h1>
          </div>
        </div>
        <Tag variant={statusInfo.variant} dot size="md">
          {t(statusInfo.labelKey)}
        </Tag>
      </div>

      <div className="relative mt-6">
        <h2 className="text-4xl font-semibold leading-tight text-black dark:text-white md:text-5xl">
          {tagline}
        </h2>
        <div className="mt-4 flex items-center gap-4 text-sm text-black dark:text-white">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{t('home.system_status')}: {t(`health.${systemStatus}`)}</span>
          </div>
          <span className="h-1 w-1 rounded-full bg-neutral-400" />
          <span>{t('home.uptime')}: {formatUptime(uptimeSeconds)}</span>
        </div>
      </div>
    </GlassCard>
  );
}
