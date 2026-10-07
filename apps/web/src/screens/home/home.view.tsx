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
  totalTables: 0,
  runningJobs: 0,
  activeTopics: 0,
  activeDAGs: 0,
  records24h: 0,
  qualityScore: 0,
  totalLag: 0,
  uptimeSeconds: 0,
  systemStatus: 'healthy',
};

function resolveModuleMetrics(
  modules: ReadonlyArray<HomeModuleItem>,
  stats: typeof FALLBACK_STATS,
  hasError: boolean,
): ReadonlyArray<HomeModuleItem> {
  return modules.map((mod) => {
    let metric = '—';
    switch (mod.key) {
      case 'catalog':
        metric = String(stats.totalTables);
        break;
      case 'bronze':
      case 'silver':
      case 'gold':
        metric = String(stats.records24h);
        break;
      case 'kafka':
        metric = String(stats.activeTopics);
        break;
      case 'crawler':
        metric = String(stats.runningJobs);
        break;
      case 'airflow':
        metric = String(stats.activeDAGs);
        break;
      case 'dq':
        metric = `${stats.qualityScore}%`;
        break;
      case 'health':
        metric = hasError ? '—' : 'OK';
        break;
    }
    return { ...mod, metric };
  });
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

  const modulesWithMetrics = resolveModuleMetrics(HOME_MODULES, statsData, statsQuery.isError);

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
      quickStats={<QuickStatsGrid stats={quickStats} />}
      modules={<ModuleGrid modules={modulesWithMetrics} />}
      activity={<ActivityFeed items={HOME_ACTIVITY} />}
    />
  );
}
