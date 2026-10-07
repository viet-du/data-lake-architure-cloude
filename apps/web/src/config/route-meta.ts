import type { RoutePath } from '@/navigation/routes';
import type { DocumentMeta } from '@/hooks';

export const ROUTE_META: Readonly<Record<RoutePath, Omit<DocumentMeta, 'ogType'>>> = {
  '/': {
    title: 'Lakehouse Control Plane',
    description: 'Unified data lakehouse orchestration, observability and control plane',
    keywords: 'lakehouse, data, etl, elt, medallion, kafka, airflow',
  },
  '/catalog': {
    title: 'Catalog · Lakehouse',
    description: 'Browse databases, tables and schema metadata',
  },
  '/bronze': {
    title: 'Bronze · Lakehouse',
    description: 'Raw ingestion layer with table, jobs and triggers',
  },
  '/silver': {
    title: 'Silver · Lakehouse',
    description: 'Cleansed, conformed and time-travel tables',
  },
  '/gold': {
    title: 'Gold · Lakehouse',
    description: 'Business aggregates, KPIs and analytics',
  },
  '/crawler': {
    title: 'Crawler · Lakehouse',
    description: 'Web scraping pipelines, jobs and run history',
  },
  '/kafka': {
    title: 'Kafka · Lakehouse',
    description: 'Topics, consumer groups, partitions and lag',
  },
  '/airflow': {
    title: 'Airflow · Lakehouse',
    description: 'DAGs, runs, tasks and orchestration timeline',
  },
  '/dq': {
    title: 'Data Quality · Lakehouse',
    description: 'Data quality rules, suites and scoring',
  },
  '/health': {
    title: 'System Health · Lakehouse',
    description: 'Service status, dependencies and resources',
  },
  '/schematic': {
    title: 'Pipeline Schematic · Lakehouse',
    description: 'Live 3D data flow across medallion layers',
  },
  '/settings': {
    title: 'Settings · Lakehouse',
    description: 'User, language and theme settings',
  },
};
