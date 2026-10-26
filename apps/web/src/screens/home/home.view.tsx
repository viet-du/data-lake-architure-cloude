import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  HeroHeaderCard,
  QuickStatsGrid,
  ModuleGrid,
  ActivityFeed,
  BentoGrid,
  QualityWindowSelector,
} from '@/components/home';
import { useHomeStatsQuery, useDashboardActivityQuery } from '@/services/queries';
import { HOME_MODULES, buildHomeQuickStats, formatMetricValue } from './home.constants';
import { ErrorBoundary, EmptyState } from '@/components';
import type { HomeModuleItem, HomeActivityEventItem } from '@/components/home';
import { ROUTES, type RoutePath } from '@/navigation/routes';
import type { EIconName } from '@/assets';
import type { DashboardActivityEvent, EDashboardMetricStatus } from '@/types/entities';
import type { EHealthStatus } from '@/types/commons';
import { useDashboardStore } from '@/store';

const FALLBACK_STATS = {
  summary: null,
  scope: null,
  totalTables: null,
  runningJobs: null,
  activeTopics: null,
  activeDAGs: null,
  recordsProcessed: null,
  qualityScore: null,
  totalLag: null,
  uptimeSeconds: null,
  systemStatus: 'unknown' as const,
  partial: true,
  recordsByStage: { bronze: null, silver: null, gold: null },
} as const;

/**
 * The activity event → the module card it belongs to.
 *
 * The mapping is derived from the *kind* of the event, not from a hard-coded
 * list of rows. An event the control plane does not know about falls back to
 * the Catalog module, so a new operation kind is visible instead of dropped.
 */
function resolveModuleKey(event: DashboardActivityEvent): string {
  if (event.type === 'audit') return 'health';
  const kind = event.reference;
  if (kind.startsWith('bronze')) return 'bronze';
  if (kind.startsWith('silver')) return 'silver';
  if (kind.startsWith('gold')) return 'gold';
  if (kind.startsWith('dq')) return 'dq';
  if (kind.startsWith('crawler')) return 'crawler';
  if (kind.startsWith('airflow')) return 'airflow';
  return 'catalog';
}
const MODULE_ICON: Readonly<Record<string, EIconName>> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  dq: 'Analyst',
  crawler: 'Pipeline',
  airflow: 'Airflow',
  health: 'Cloud',
  catalog: 'HiveMetastore',
};

/**
 * The activity status → the dot colour vocabulary.
 *
 * A cancelled or denied event is *not* a success, and an unknown status is
 * not a failure either — it is informational.
 */
function resolveEventStatus(status: string): HomeActivityEventItem['status'] {
  switch (status) {
    case 'succeeded':
    case 'success':
    case 'pass':
      return 'success';
    case 'failed':
    case 'failure':
    case 'error':
    case 'denied':
    case 'cancelled':
      return 'failed';
    case 'running':
    case 'queued':
    case 'pending':
      return 'running';
    default:
      return 'info';
  }
}

/** The route an activity event links to. */
function resolveEventPath(event: DashboardActivityEvent): RoutePath {
  switch (resolveModuleKey(event)) {
    case 'bronze':
      return ROUTES.BRONZE;
    case 'silver':
      return ROUTES.SILVER;
    case 'gold':
      return ROUTES.GOLD;
    case 'dq':
      return ROUTES.DQ;
    case 'crawler':
      return ROUTES.CRAWLER;
    case 'airflow':
      return ROUTES.AIRFLOW;
    case 'health':
      return ROUTES.HEALTH;
    default:
      return ROUTES.CATALOG;
  }
}

function toActivityItem(event: DashboardActivityEvent): HomeActivityEventItem {
  const moduleKey = resolveModuleKey(event);
  return {
    id: event.id,
    title: event.title,
    moduleKey,
    iconName: MODULE_ICON[moduleKey] ?? 'HiveMetastore',
    status: resolveEventStatus(event.status),
    timestamp: event.at,
    path: resolveEventPath(event),
    actor: event.actor,
    reference: event.reference,
  };
}

/**
 * The metric status → the module card's health vocabulary.
 *
 * The card's badge used to be hard-coded to `unknown` ("Not checked") for
 * every module except Health, so a working Kafka cluster and a dead one
 * looked identical on the module grid. The read model already carries the
 * status of every metric, so the card derives its badge from it.
 *
 * The mapping is deliberately conservative:
 *
 *  * `ok` → healthy;
 *  * `stale` → degraded (a real but old reading);
 *  * `unavailable` → unhealthy (the source failed);
 *  * `not_evaluated` → degraded (there is no evidence, but nothing failed).
 */
function resolveMetricHealth(status: EDashboardMetricStatus): EHealthStatus {
  switch (status) {
    case 'ok':
      return 'healthy';
    case 'stale':
    case 'not_evaluated':
      return 'degraded';
    case 'unavailable':
      return 'unhealthy';
    default:
      return 'unknown';
  }
}

/**
 * The module card's metric and badge, derived from the read model.
 *
 * Every module's number is the *same* metric the Home quick-stat card
 * shows, so the grid and the stats can never disagree.
 */
function resolveModuleMetrics(
  modules: ReadonlyArray<HomeModuleItem>,
  stats: typeof FALLBACK_STATS | ReturnType<typeof useHomeStatsQuery>['data'],
): ReadonlyArray<HomeModuleItem> {
  const summary = stats?.summary ?? null;
  return modules.map((mod) => {
    let metric = '—';
    let metricLabelKey = mod.metricLabelKey;
    let metricStatus: EDashboardMetricStatus | undefined;

    switch (mod.key) {
      case 'catalog':
        metricStatus = summary?.metrics.totalTables.status;
        metric = formatMetricValue(summary?.metrics.totalTables);
        metricLabelKey = 'home.stats.total_tables';
        break;
      case 'bronze':
        // The Bronze card shows the *stage's own* committed record count.
        // It is not the "all layers" number, because adding the layers
        // would count every row three times.
        metricStatus = summary?.metrics.recordsByStage.bronze.status;
        metric = formatMetricValue(summary?.metrics.recordsByStage.bronze);
        metricLabelKey = 'home.stats.stage_records';
        break;
      case 'silver':
        metricStatus = summary?.metrics.recordsByStage.silver.status;
        metric = formatMetricValue(summary?.metrics.recordsByStage.silver);
        metricLabelKey = 'home.stats.stage_records';
        break;
      case 'gold':
        metricStatus = summary?.metrics.recordsByStage.gold.status;
        metric = formatMetricValue(summary?.metrics.recordsByStage.gold);
        metricLabelKey = 'home.stats.stage_records';
        break;
      case 'kafka':
        metricStatus = summary?.metrics.activeTopics.status;
        metric = formatMetricValue(summary?.metrics.activeTopics);
        metricLabelKey = 'home.stats.active_topics';
        break;
      case 'airflow':
        metricStatus = summary?.metrics.activeDAGs.status;
        metric = formatMetricValue(summary?.metrics.activeDAGs);
        metricLabelKey = 'home.stats.dags_active';
        break;
      case 'crawler':
        metricStatus = summary?.metrics.runningJobs.status;
        metric = formatMetricValue(summary?.metrics.runningJobs);
        metricLabelKey = 'home.stats.running_jobs';
        break;
      case 'dq':
        // The pass rate is a **percentage** (0–100) — the API converts it
        // from the DQ ledger's fraction at the boundary.
        metricStatus = summary?.metrics.qualityPassRate.status;
        metric =
          summary?.metrics.qualityPassRate.value === null ||
          summary?.metrics.qualityPassRate.value === undefined
            ? '—'
            : `${summary.metrics.qualityPassRate.value}%`;
        metricLabelKey = 'home.stats.quality_score';
        break;
      case 'health':
        metric =
          stats?.uptimeSeconds === null || stats?.uptimeSeconds === undefined
            ? '—'
            : `${Math.floor(stats.uptimeSeconds / 3600)}h ${Math.floor((stats.uptimeSeconds % 3600) / 60)}m`;
        metricLabelKey = 'home.stats.uptime';
        break;
      default:
        break;
    }

    const status =
      mod.key === 'health'
        ? (stats?.systemStatus ?? 'unknown')
        : metricStatus
          ? resolveMetricHealth(metricStatus)
          : 'unknown';

    return { ...mod, status, metric, metricLabelKey };
  });
}

export function HomeView() {
  const { t } = useTranslation();
  // The quality window is shared state: the Home card and the Schematic
  // badge must always describe the same population. It lives in a store so
  // both screens read the same value — and so the choice survives a
  // navigation.
  const qualityWindow = useDashboardStore((state) => state.qualityWindow);
  const setQualityWindow = useDashboardStore((state) => state.setQualityWindow);

  const statsQuery = useHomeStatsQuery({ window: qualityWindow });
  const statsData = statsQuery.data ?? FALLBACK_STATS;
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [previousPages, setPreviousPages] = useState<ReadonlyArray<ReadonlyArray<DashboardActivityEvent>>>([]);

  const activityQuery = useDashboardActivityQuery(
    cursor ? { cursor, limit: 20 } : { limit: 20 },
  );

  const activityItems = useMemo(() => {
    const current = activityQuery.data?.activity ?? [];
    const merged = cursor ? [...previousPages.flat(), ...current] : current;
    return merged.map(toActivityItem);
  }, [activityQuery.data, cursor, previousPages]);

  const quickStats = buildHomeQuickStats({
    totalTables: statsData.summary?.metrics.totalTables,
    runningJobs: statsData.summary?.metrics.runningJobs,
    activeTopics: statsData.summary?.metrics.activeTopics,
    activeDAGs: statsData.summary?.metrics.activeDAGs,
    recordsProcessed: statsData.summary?.metrics.recordsProcessed,
    qualityScore: statsData.summary?.metrics.qualityPassRate,
    totalLag: statsData.summary?.metrics.totalLag,
    uptimeSeconds: statsData.uptimeSeconds,
  });

  const modulesWithMetrics = resolveModuleMetrics(HOME_MODULES, statsData);

  const loadMore = () => {
    const next = activityQuery.data?.nextCursor;
    if (!next) return;
    setPreviousPages((previous) => [...previous, activityQuery.data?.activity ?? []]);
    setCursor(next);
  };

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
      quickStats={
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            {statsData.partial ? (
              <p role="status" className="text-sm">
                {t('home.partial')}
              </p>
            ) : (
              <span />
            )}
            <QualityWindowSelector
              value={qualityWindow}
              onChange={setQualityWindow}
            />
          </div>
          <QuickStatsGrid stats={quickStats} />
        </div>
      }
      modules={<ModuleGrid modules={modulesWithMetrics} />}
      activity={
        <ActivityFeed
          items={activityItems}
          partial={activityQuery.data?.partial === true}
          loading={activityQuery.isFetching}
          nextCursor={activityQuery.data?.nextCursor ?? null}
          onLoadMore={loadMore}
        />
      }
    />
  );
}
