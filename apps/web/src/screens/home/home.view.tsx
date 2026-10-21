import { useTranslation } from 'react-i18next';
import {
  HeroHeaderCard,
  QuickStatsGrid,
  ModuleGrid,
  ActivityFeed,
  BentoGrid,
} from '@/components/home';
import { useHomeStatsQuery, type HomeAggregatedStats } from '@/services/queries';
import { HOME_ACTIVITY, HOME_MODULES, buildHomeQuickStats } from './home.constants';
import { ErrorBoundary, EmptyState } from '@/components';
import type { HomeModuleItem } from '@/components/home';

const FALLBACK_STATS: HomeAggregatedStats = {
  totalTables: null,
  runningJobs: null,
  activeTopics: null,
  activeDAGs: null,
  records24h: null,
  qualityScore: null,
  totalLag: null,
  uptimeSeconds: null,
  systemStatus: 'unknown',
  partial: true,
};

function resolveModuleMetrics(
  modules: ReadonlyArray<HomeModuleItem>,
  stats: typeof FALLBACK_STATS,
): ReadonlyArray<HomeModuleItem> {
  return modules.map((mod) => ({
    ...mod,
    status: mod.key === 'health' ? stats.systemStatus : 'unknown',
    metricLabelKey: ['bronze', 'silver', 'gold'].includes(mod.key) ? 'home.stats.total_tables' : mod.metricLabelKey,
    metric: mod.key === 'bronze' || mod.key === 'silver' || mod.key === 'gold' ? String(stats.layerTables?.[mod.key] ?? '—') : mod.key === 'catalog' ? (stats.totalTables === null ? '—' : String(stats.totalTables))
      : mod.key === 'kafka' ? (stats.activeTopics === null ? '—' : String(stats.activeTopics))
      : mod.key === 'airflow' ? (stats.activeDAGs === null ? '—' : String(stats.activeDAGs))
      : mod.key === 'dq' ? (stats.qualityScore === null ? '—' : `${stats.qualityScore}%`) : '—',
  }));
}

export function HomeView() {
  const { t } = useTranslation();
  const statsQuery = useHomeStatsQuery();
  const statsData = statsQuery.data ?? FALLBACK_STATS;

  const quickStats = buildHomeQuickStats({
    totalTables: statsData.totalTables,
    runningJobs: statsData.runningJobs,
    activeTopics: statsData.activeTopics,
    activeDAGs: statsData.activeDAGs,
    records24h: statsData.records24h,
    qualityScore: statsData.qualityScore,
    totalLag: statsData.totalLag,
    uptimeSeconds: statsData.uptimeSeconds,
  });

  const modulesWithMetrics = resolveModuleMetrics(HOME_MODULES, statsData);

  return (
    <BentoGrid
      hero={
        <ErrorBoundary fallback={() => <EmptyState compact title={t('common.error')} />}>
          <HeroHeaderCard
            appName={t('app.name')}
            tagline={t('app.tagline')}
            systemStatus={statsData.systemStatus}
            uptimeSeconds={statsData.uptimeSeconds}
          />
        </ErrorBoundary>
      }
      quickStats={<div>{statsData.partial ? <p role="status" className="mb-3 text-sm">{t('home.partial')}</p> : null}<QuickStatsGrid stats={quickStats} /></div>}
      modules={<ModuleGrid modules={modulesWithMetrics} />}
      activity={<ActivityFeed items={HOME_ACTIVITY} />}
    />
  );
}
