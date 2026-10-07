import type { EIconName } from '@/assets';
import type { EHealthStatus } from '@/types/commons';
import type { RoutePath } from '@/navigation/routes';

export interface HomeModuleItem {
  key: string;
  path: RoutePath;
  iconName: EIconName;
  titleKey: string;
  descriptionKey: string;
  categoryKey: string;
  accent: 'primary' | 'bronze' | 'silver' | 'gold' | 'kafka' | 'airflow' | 'dq' | 'crawler' | 'health';
  status: EHealthStatus;
  metric: string;
  metricLabelKey: string;
  progress?: number;
  sparkline?: ReadonlyArray<number>;
}

export interface HomeQuickStat {
  key: string;
  labelKey: string;
  value: string;
  delta?: number;
  accent: 'primary' | 'bronze' | 'silver' | 'gold' | 'kafka' | 'airflow' | 'dq' | 'crawler' | 'health';
}

export interface HomeActivityItem {
  id: string;
  titleKey: string;
  moduleKey: string;
  iconName: EIconName;
  status: 'success' | 'failed' | 'running' | 'info';
  timestamp: string;
  path: RoutePath;
}
