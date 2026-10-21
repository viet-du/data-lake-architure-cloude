import { ROUTES } from '@/navigation/routes';
import type { HomeActivityItem, HomeModuleItem, HomeQuickStat } from '@/components/home';

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
    metricLabelKey: 'home.stats.records_24h',
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
    metricLabelKey: 'home.stats.records_24h',
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
    metricLabelKey: 'home.stats.records_24h',
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

export function buildHomeQuickStats(input: {
  totalTables: number | null;
  runningJobs: number | null;
  activeTopics: number | null;
  activeDAGs: number | null;
  records24h: number | null;
  qualityScore: number | null;
  totalLag: number | null;
  uptimeSeconds: number | null;
}): ReadonlyArray<HomeQuickStat> {
  return [
    { key: 'tables', labelKey: 'home.stats.total_tables', value: formatNumber(input.totalTables), accent: 'primary' },
    { key: 'jobs', labelKey: 'home.stats.running_jobs', value: formatNumber(input.runningJobs), accent: 'bronze' },
    { key: 'topics', labelKey: 'home.stats.active_topics', value: formatNumber(input.activeTopics), accent: 'kafka' },
    { key: 'dags', labelKey: 'home.stats.dags_active', value: formatNumber(input.activeDAGs), accent: 'airflow' },
    { key: 'records', labelKey: 'home.stats.records_24h', value: formatNumber(input.records24h), accent: 'silver' },
    { key: 'quality', labelKey: 'home.stats.quality_score', value: input.qualityScore === null ? '—' : `${input.qualityScore}%`, accent: 'dq' },
  ];
}

export const HOME_ACTIVITY: ReadonlyArray<HomeActivityItem> = [];
