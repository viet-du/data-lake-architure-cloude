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
    status: 'healthy',
    metric: '0',
    metricLabelKey: 'home.stats.total_tables',
    progress: 86,
    sparkline: [62, 65, 68, 70, 72, 75, 78, 80, 82, 84, 86],
  },
  {
    key: 'bronze',
    path: ROUTES.BRONZE,
    iconName: 'Bronze',
    titleKey: 'home.modules.bronze.title',
    descriptionKey: 'home.modules.bronze.description',
    categoryKey: 'home.ingestion',
    accent: 'bronze',
    status: 'healthy',
    metric: '0',
    metricLabelKey: 'home.stats.records_24h',
    progress: 94,
    sparkline: [70, 72, 76, 80, 82, 85, 88, 90, 92, 93, 94],
  },
  {
    key: 'silver',
    path: ROUTES.SILVER,
    iconName: 'Silver',
    titleKey: 'home.modules.silver.title',
    descriptionKey: 'home.modules.silver.description',
    categoryKey: 'home.transformation',
    accent: 'silver',
    status: 'healthy',
    metric: '0',
    metricLabelKey: 'home.stats.records_24h',
    progress: 78,
    sparkline: [55, 58, 62, 64, 67, 70, 72, 74, 76, 77, 78],
  },
  {
    key: 'gold',
    path: ROUTES.GOLD,
    iconName: 'Gold',
    titleKey: 'home.modules.gold.title',
    descriptionKey: 'home.modules.gold.description',
    categoryKey: 'home.aggregation',
    accent: 'gold',
    status: 'healthy',
    metric: '0',
    metricLabelKey: 'home.stats.records_24h',
    progress: 72,
    sparkline: [48, 52, 55, 58, 60, 63, 65, 68, 70, 71, 72],
  },
  {
    key: 'kafka',
    path: ROUTES.KAFKA,
    iconName: 'Kafka',
    titleKey: 'home.modules.kafka.title',
    descriptionKey: 'home.modules.kafka.description',
    categoryKey: 'home.messaging',
    accent: 'kafka',
    status: 'healthy',
    metric: '0',
    metricLabelKey: 'home.stats.active_topics',
    progress: 64,
    sparkline: [40, 44, 47, 50, 53, 56, 58, 60, 62, 63, 64],
  },
  {
    key: 'crawler',
    path: ROUTES.CRAWLER,
    iconName: 'Pipeline',
    titleKey: 'home.modules.crawler.title',
    descriptionKey: 'home.modules.crawler.description',
    categoryKey: 'home.crawling',
    accent: 'crawler',
    status: 'healthy',
    metric: '0',
    metricLabelKey: 'home.stats.running_jobs',
    progress: 52,
    sparkline: [32, 35, 38, 41, 43, 45, 47, 49, 50, 51, 52],
  },
  {
    key: 'airflow',
    path: ROUTES.AIRFLOW,
    iconName: 'Airflow',
    titleKey: 'home.modules.airflow.title',
    descriptionKey: 'home.modules.airflow.description',
    categoryKey: 'home.orchestration',
    accent: 'airflow',
    status: 'healthy',
    metric: '0',
    metricLabelKey: 'home.stats.dags_active',
    progress: 68,
    sparkline: [50, 53, 56, 58, 60, 62, 64, 65, 66, 67, 68],
  },
  {
    key: 'dq',
    path: ROUTES.DQ,
    iconName: 'Analyst',
    titleKey: 'home.modules.dq.title',
    descriptionKey: 'home.modules.dq.description',
    categoryKey: 'home.quality',
    accent: 'dq',
    status: 'healthy',
    metric: '0',
    metricLabelKey: 'home.stats.quality_score',
    progress: 88,
    sparkline: [72, 75, 78, 80, 82, 84, 85, 86, 87, 88, 88],
  },
  {
    key: 'health',
    path: ROUTES.HEALTH,
    iconName: 'Cloud',
    titleKey: 'home.modules.health.title',
    descriptionKey: 'home.modules.health.description',
    categoryKey: 'home.monitoring',
    accent: 'health',
    status: 'healthy',
    metric: '0',
    metricLabelKey: 'home.stats.uptime',
    progress: 96,
    sparkline: [82, 85, 87, 89, 90, 92, 93, 94, 95, 95, 96],
  },
];

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function buildHomeQuickStats(input: {
  totalTables: number;
  runningJobs: number;
  activeTopics: number;
  activeDAGs: number;
  records24h: number;
  qualityScore: number;
  totalLag: number;
  uptimeSeconds: number;
}): ReadonlyArray<HomeQuickStat> {
  return [
    { key: 'tables', labelKey: 'home.stats.total_tables', value: formatNumber(input.totalTables), accent: 'primary' },
    { key: 'jobs', labelKey: 'home.stats.running_jobs', value: formatNumber(input.runningJobs), accent: 'bronze', delta: 12 },
    { key: 'topics', labelKey: 'home.stats.active_topics', value: formatNumber(input.activeTopics), accent: 'kafka' },
    { key: 'dags', labelKey: 'home.stats.dags_active', value: formatNumber(input.activeDAGs), accent: 'airflow', delta: 4 },
    { key: 'records', labelKey: 'home.stats.records_24h', value: formatNumber(input.records24h), accent: 'silver', delta: 28 },
    { key: 'quality', labelKey: 'home.stats.quality_score', value: `${input.qualityScore}%`, accent: 'dq', delta: input.qualityScore >= 90 ? 2 : -1 },
  ];
}

function buildMockActivity(): ReadonlyArray<HomeActivityItem> {
  const now = Date.now();
  const minutes = (m: number) => new Date(now - m * 60_000).toISOString();
  return [
    { id: 'a1', titleKey: 'home.activity_items.ingest_started', moduleKey: 'bronze', iconName: 'Bronze', status: 'running', timestamp: minutes(2), path: ROUTES.BRONZE },
    { id: 'a2', titleKey: 'home.activity_items.transform_completed', moduleKey: 'silver', iconName: 'Silver', status: 'success', timestamp: minutes(7), path: ROUTES.SILVER },
    { id: 'a3', titleKey: 'home.activity_items.gold_refresh', moduleKey: 'gold', iconName: 'Gold', status: 'success', timestamp: minutes(15), path: ROUTES.GOLD },
    { id: 'a4', titleKey: 'home.activity_items.airflow_dag_success', moduleKey: 'airflow', iconName: 'Airflow', status: 'success', timestamp: minutes(23), path: ROUTES.AIRFLOW },
    { id: 'a5', titleKey: 'home.activity_items.crawler_run', moduleKey: 'crawler', iconName: 'Pipeline', status: 'success', timestamp: minutes(34), path: ROUTES.CRAWLER },
    { id: 'a6', titleKey: 'home.activity_items.kafka_topic_created', moduleKey: 'kafka', iconName: 'Kafka', status: 'info', timestamp: minutes(48), path: ROUTES.KAFKA },
    { id: 'a7', titleKey: 'home.activity_items.dq_alert', moduleKey: 'dq', iconName: 'Analyst', status: 'failed', timestamp: minutes(72), path: ROUTES.DQ },
  ];
}

export const HOME_ACTIVITY: ReadonlyArray<HomeActivityItem> = buildMockActivity();