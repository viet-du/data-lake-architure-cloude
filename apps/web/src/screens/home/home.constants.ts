import { ROUTES } from '@/navigation/routes';
import type { HomeModuleItem, HomeQuickStat } from '@/components/home';
import type { DashboardMetric, EDashboardMetricStatus } from '@/types/entities';

export const HOME_MODULES: ReadonlyArray<HomeModuleItem> = [
  {
    key: 'catalog',
    path: ROUTES.CATALOG,
    iconName: 'HiveMetastore',
    titleKey: 'home.modules.catalog.title',
    descriptionKey: 'home.modules.catalog.description',
    categoryKey: 'home.metadata',
    accent: 'primary',
    status: 'unknown',
    metric: '0',
    metricLabelKey: 'home.stats.total_tables',
  },
  {
    key: 'bronze',
    path: ROUTES.BRONZE,
    iconName: 'Bronze',
    titleKey: 'home.modules.bronze.title',
    descriptionKey: 'home.modules.bronze.description',
    categoryKey: 'home.ingestion',
    accent: 'bronze',
    status: 'unknown',
    metric: '0',
    metricLabelKey: 'home.stats.stage_records',
  },
  {
    key: 'silver',
    path: ROUTES.SILVER,
    iconName: 'Silver',
    titleKey: 'home.modules.silver.title',
    descriptionKey: 'home.modules.silver.description',
    categoryKey: 'home.transformation',
    accent: 'silver',
    status: 'unknown',
    metric: '0',
    metricLabelKey: 'home.stats.stage_records',
  },
  {
    key: 'gold',
    path: ROUTES.GOLD,
    iconName: 'Gold',
    titleKey: 'home.modules.gold.title',
    descriptionKey: 'home.modules.gold.description',
    categoryKey: 'home.aggregation',
    accent: 'gold',
    status: 'unknown',
    metric: '0',
    metricLabelKey: 'home.stats.stage_records',
  },
  {
    key: 'kafka',
    path: ROUTES.KAFKA,
    iconName: 'Kafka',
    titleKey: 'home.modules.kafka.title',
    descriptionKey: 'home.modules.kafka.description',
    categoryKey: 'home.messaging',
    accent: 'kafka',
    status: 'unknown',
    metric: '0',
    metricLabelKey: 'home.stats.active_topics',
  },
  {
    key: 'crawler',
    path: ROUTES.CRAWLER,
    iconName: 'Pipeline',
    titleKey: 'home.modules.crawler.title',
    descriptionKey: 'home.modules.crawler.description',
    categoryKey: 'home.crawling',
    accent: 'crawler',
    status: 'unknown',
    metric: '0',
    metricLabelKey: 'home.stats.running_jobs',
  },
  {
    key: 'airflow',
    path: ROUTES.AIRFLOW,
    iconName: 'Airflow',
    titleKey: 'home.modules.airflow.title',
    descriptionKey: 'home.modules.airflow.description',
    categoryKey: 'home.orchestration',
    accent: 'airflow',
    status: 'unknown',
    metric: '0',
    metricLabelKey: 'home.stats.dags_active',
  },
  {
    key: 'dq',
    path: ROUTES.DQ,
    iconName: 'Analyst',
    titleKey: 'home.modules.dq.title',
    descriptionKey: 'home.modules.dq.description',
    categoryKey: 'home.quality',
    accent: 'dq',
    status: 'unknown',
    metric: '0',
    metricLabelKey: 'home.stats.quality_score',
  },
  {
    key: 'health',
    path: ROUTES.HEALTH,
    iconName: 'Cloud',
    titleKey: 'home.modules.health.title',
    descriptionKey: 'home.modules.health.description',
    categoryKey: 'home.monitoring',
    accent: 'health',
    status: 'unknown',
    metric: '0',
    metricLabelKey: 'home.stats.uptime',
  },
];

function formatNumber(n: number | null): string {
  if (n === null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/**
 * The value of a metric, rendered for the card.
 *
 * A metric that was not measured is `—`, not `0`. The distinction matters:
 * a `0` reads as "there are no records", while `—` reads as "we do not
 * know", which is what a degraded provider actually means.
 */
export function formatMetricValue(metric: DashboardMetric | undefined): string {
  if (!metric || metric.value === null) return '—';
  return formatNumber(metric.value);
}

/**
 * The Home quick stats.
 *
 * MASTER PLAN §08: the numbers come from the API's read model, so this
 * function only *renders* them — it never aggregates two sources into one
 * number. In particular `records` is the Bronze ingestion stage's committed
 * input record count and is never the sum of the three layers.
 *
 * Each card keeps the **status** of its metric, so the UI can tell a
 * stale last-known value apart from a metric whose source failed and
 * from one that was never evaluated. Collapsing all three into "—" would
 * throw away exactly the information the metric contract exists to
 * carry.
 */
export function buildHomeQuickStats(input: {
  totalTables: DashboardMetric | undefined;
  runningJobs: DashboardMetric | undefined;
  activeTopics: DashboardMetric | undefined;
  activeDAGs: DashboardMetric | undefined;
  recordsProcessed: DashboardMetric | undefined;
  qualityScore: DashboardMetric | undefined;
  totalLag: DashboardMetric | undefined;
  uptimeSeconds: number | null;
}): ReadonlyArray<HomeQuickStat> {
  const metric = (value: DashboardMetric | undefined): EDashboardMetricStatus =>
    value?.status ?? 'unavailable';

  return [
    {
      key: 'tables',
      labelKey: 'home.stats.total_tables',
      value: formatMetricValue(input.totalTables),
      accent: 'primary',
      status: metric(input.totalTables),
    },
    {
      key: 'jobs',
      labelKey: 'home.stats.running_jobs',
      value: formatMetricValue(input.runningJobs),
      accent: 'bronze',
      status: metric(input.runningJobs),
    },
    {
      key: 'topics',
      labelKey: 'home.stats.active_topics',
      value: formatMetricValue(input.activeTopics),
      accent: 'kafka',
      status: metric(input.activeTopics),
    },
    {
      key: 'dags',
      labelKey: 'home.stats.dags_active',
      value: formatMetricValue(input.activeDAGs),
      accent: 'airflow',
      status: metric(input.activeDAGs),
    },
    {
      key: 'records',
      labelKey: 'home.stats.records_all_time',
      value: formatMetricValue(input.recordsProcessed),
      accent: 'silver',
      status: metric(input.recordsProcessed),
    },
    {
      key: 'quality',
      labelKey: 'home.stats.quality_score',
      // The pass rate is a **percentage** (0–100) — the API converts it
      // from the DQ ledger's fraction at the boundary.
      value:
        input.qualityScore?.value === null || input.qualityScore?.value === undefined
          ? '—'
          : `${input.qualityScore.value}%`,
      accent: 'dq',
      status: metric(input.qualityScore),
      ...(input.qualityScore?.window !== undefined
        ? { window: input.qualityScore.window }
        : {}),
      // No evaluation exists yet: say where to run one. The value stays
      // "Not evaluated" — the CTA never fabricates a percentage.
      ...(input.qualityScore?.status === 'not_evaluated'
        ? { action: { labelKey: 'home.quality_cta.run', path: ROUTES.DQ } }
        : {}),
    },
  ];
}
