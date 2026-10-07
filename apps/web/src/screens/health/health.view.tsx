import { useTranslation } from 'react-i18next';
import {
  useHealthQuery,
  useDeepHealthQuery,
} from '@/services/queries';
import {
  Tag,
  Button,
  EmptyState,
  ErrorBoundary,
  ScreenPageHeader,
  ScreenSection,
  ScreenLoading,
  ScreenError,
} from '@/components';
import { cn } from '@/theme';
import type { EHealthStatus } from '@/types/commons';

const STATUS_VARIANT: Readonly<Record<EHealthStatus, 'success' | 'warning' | 'error'>> = {
  healthy: 'success',
  degraded: 'warning',
  unhealthy: 'error',
};

function formatMs(n: number): string {
  if (n < 1) return '<1ms';
  if (n > 1000) return `${(n / 1000).toFixed(2)}s`;
  return `${n.toFixed(1)}ms`;
}

function StatusBanner() {
  const { t } = useTranslation();
  const statusQuery = useHealthQuery();
  const status = statusQuery.data;
  if (statusQuery.isLoading) return <ScreenLoading rows={1} />;
  if (statusQuery.isError) {
    return <ScreenError error={statusQuery.error} onRetry={() => void statusQuery.refetch()} compact />;
  }
  if (status === null || status === undefined) {
    return <EmptyState compact title="No status" />;
  }
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between',
        status.status === 'healthy' && 'border-emerald-500/30 bg-emerald-500/5',
        status.status === 'degraded' && 'border-amber-500/30 bg-amber-500/5',
        status.status === 'unhealthy' && 'border-red-500/30 bg-red-500/5',
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'h-3 w-3 rounded-full',
            status.status === 'healthy' && 'bg-emerald-500',
            status.status === 'degraded' && 'bg-amber-500',
            status.status === 'unhealthy' && 'bg-red-500',
          )}
        />
        <div>
          <p className="text-xs uppercase tracking-wider text-neutral-500">{t('screens.health.status')}</p>
          <p className="text-xl font-bold capitalize text-neutral-900 dark:text-neutral-50">
            {status.status}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-[10px] text-neutral-500">
        <span>Uptime: {Math.floor(status.uptime / 3600)}h {Math.floor((status.uptime % 3600) / 60)}m</span>
        <span>v{status.version}</span>
        <span>{status.services.length} services</span>
      </div>
    </div>
  );
}

function ServicesGrid() {
  const { t } = useTranslation();
  const healthQuery = useHealthQuery();
  if (healthQuery.isLoading) return <ScreenLoading rows={6} variant="grid" />;
  if (healthQuery.isError) {
    return <ScreenError error={healthQuery.error} onRetry={() => void healthQuery.refetch()} compact />;
  }
  const items = healthQuery.data?.services ?? [];
  if (items.length === 0) return <EmptyState compact title="No services" />;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((svc) => {
        const variant = STATUS_VARIANT[svc.status];
        return (
          <div
            key={svc.name}
            className="flex flex-col gap-2 rounded-xl border border-white/5 bg-white/5 p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                {svc.name}
              </span>
              {variant !== undefined ? (
                <Tag size="sm" variant={variant} dot>
                  {svc.status}
                </Tag>
              ) : null}
            </div>
            {svc.message !== undefined ? (
              <p className="text-[10px] text-neutral-500">{svc.message}</p>
            ) : null}
            <div className="mt-1 flex items-center justify-between text-[10px] text-neutral-500">
              <span>{t('common.latency')}: {svc.durationMs !== undefined ? formatMs(svc.durationMs) : '—'}</span>
              <span>{new Date(svc.lastCheckedAt).toLocaleTimeString()}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DependenciesList() {
  const deepQuery = useDeepHealthQuery();
  if (deepQuery.isLoading) return <ScreenLoading rows={4} />;
  if (deepQuery.isError) {
    return <ScreenError error={deepQuery.error} onRetry={() => void deepQuery.refetch()} compact />;
  }
  const deps = deepQuery.data?.dependencies;
  if (deps === undefined) {
    return <EmptyState compact title="No dependencies" />;
  }
  const items: ReadonlyArray<{ name: string; status: EHealthStatus }> = [
    { name: 'MinIO', status: deps.minio },
    { name: 'Kafka', status: deps.kafka },
    { name: 'MongoDB', status: deps.mongodb },
    { name: 'Redis', status: deps.redis },
    { name: 'Spark', status: deps.spark },
    { name: 'Delta Lake', status: deps.deltaLake },
  ];
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((dep) => {
        const variant = STATUS_VARIANT[dep.status];
        return (
          <div
            key={dep.name}
            className="flex items-center justify-between rounded-md border border-white/5 bg-white/5 p-3"
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  dep.status === 'healthy' && 'bg-emerald-500',
                  dep.status === 'degraded' && 'bg-amber-500',
                  dep.status === 'unhealthy' && 'bg-red-500',
                )}
              />
              <span className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{dep.name}</span>
            </div>
            {variant !== undefined ? (
              <Tag size="sm" variant={variant}>
                {dep.status}
              </Tag>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function SystemStats() {
  const deepQuery = useDeepHealthQuery();
  if (deepQuery.isLoading) return <ScreenLoading rows={1} />;
  const sys = deepQuery.data?.system;
  if (sys === undefined) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-lg border border-white/5 bg-white/5 p-3">
        <p className="text-[10px] uppercase tracking-wider text-neutral-500">CPU</p>
        <p className="mt-1 text-xl font-bold text-neutral-900 dark:text-neutral-50">
          {sys.cpuPercent.toFixed(0)}%
        </p>
      </div>
      <div className="rounded-lg border border-white/5 bg-white/5 p-3">
        <p className="text-[10px] uppercase tracking-wider text-neutral-500">Memory</p>
        <p className="mt-1 text-xl font-bold text-neutral-900 dark:text-neutral-50">
          {sys.memoryPercent.toFixed(0)}%
        </p>
      </div>
      <div className="rounded-lg border border-white/5 bg-white/5 p-3">
        <p className="text-[10px] uppercase tracking-wider text-neutral-500">Disk</p>
        <p className="mt-1 text-xl font-bold text-neutral-900 dark:text-neutral-50">
          {sys.diskPercent.toFixed(0)}%
        </p>
      </div>
      <div className="rounded-lg border border-white/5 bg-white/5 p-3">
        <p className="text-[10px] uppercase tracking-wider text-neutral-500">Network</p>
        <p className="mt-1 text-base font-bold text-neutral-900 dark:text-neutral-50">
          {((sys.networkIn + sys.networkOut) / 1024 / 1024).toFixed(1)}MB
        </p>
      </div>
    </div>
  );
}

function DeepHealth() {
  const { t } = useTranslation();
  const deepQuery = useDeepHealthQuery();
  if (deepQuery.isLoading) return <ScreenLoading rows={3} />;
  if (deepQuery.isError) {
    return <ScreenError error={deepQuery.error} onRetry={() => void deepQuery.refetch()} compact />;
  }
  const d = deepQuery.data;
  if (d === undefined) return null;
  return (
    <div className="space-y-2 text-xs text-neutral-700 dark:text-neutral-300">
      <p>
        <span className="text-[10px] uppercase tracking-wider text-neutral-500">Up</span> ·{' '}
        {Math.floor(d.uptime / 3600)}h {Math.floor((d.uptime % 3600) / 60)}m
      </p>
      <p>
        <span className="text-[10px] uppercase tracking-wider text-neutral-500">Version</span> ·{' '}
        v{d.version}
      </p>
      <p>
        <span className="text-[10px] uppercase tracking-wider text-neutral-500">Last check</span> ·{' '}
        {new Date(d.timestamp).toLocaleString()}
      </p>
      <p>
        <span className="text-[10px] uppercase tracking-wider text-neutral-500">{t('screens.health.deep')}</span> ·{' '}
        {d.services.length} {t('screens.health.services').toLowerCase()}
      </p>
    </div>
  );
}

export function HealthView() {
  const { t } = useTranslation();
  return (
    <ErrorBoundary>
      <div className="flex h-full flex-col gap-4">
        <ScreenPageHeader
          iconName="Cloud"
          titleKey="screens.health.title"
          subtitleKey="screens.health.subtitle"
          descriptionKey="screens.health.description"
          accent="health"
          actions={
            <Button variant="ghost" size="sm">
              {t('common.refresh')}
            </Button>
          }
        />
        <StatusBanner />
        <SystemStats />
        <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-3">
          <ScreenSection
            title={t('screens.health.services')}
            padded={false}
            className="lg:col-span-2"
          >
            <div className="p-4">
              <ServicesGrid />
            </div>
          </ScreenSection>
          <ScreenSection title={t('screens.health.deep')}>
            <DeepHealth />
          </ScreenSection>
        </div>
        <div className="overflow-hidden">
          <ScreenSection title={t('screens.health.dependencies')} padded={false}>
            <div className="p-4">
              <DependenciesList />
            </div>
          </ScreenSection>
        </div>
      </div>
    </ErrorBoundary>
  );
}
