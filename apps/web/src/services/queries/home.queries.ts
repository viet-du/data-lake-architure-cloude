import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { QUERY_KEYS } from '../query-keys';
import { catalogService, bronzeService, silverService, goldService, kafkaService, airflowService, dqService, healthService } from '..';
import type { EHealthStatus } from '@/types/commons';

export interface HomeAggregatedStats {
  layerTables?: Readonly<Record<'bronze' | 'silver' | 'gold', number | null>>;
  totalTables: number | null;
  runningJobs: number | null;
  activeTopics: number | null;
  activeDAGs: number | null;
  records24h: number | null;
  qualityScore: number | null;
  uptimeSeconds: number | null;
  totalLag: number | null;
  systemStatus: EHealthStatus;
  partial: boolean;
}

export async function fetchHomeStats(): Promise<HomeAggregatedStats> {
  const [databases, bronze, silver, gold, kafka, airflow, dq, health] = await Promise.allSettled([
    catalogService.listDatabases(), bronzeService.getJobStats(), silverService.getJobStats(),
    goldService.getJobStats(), kafkaService.getStats(), airflowService.getStats(),
    dqService.getSummary(), healthService.getHealth(),
  ]);
  const layerCount = (layer: 'bronze' | 'silver' | 'gold') => {
    if (databases.status !== 'fulfilled') return null;
    const matching = databases.value.filter((database) => database.layers.includes(layer));
    return matching.some((database) => database.layers.length > 1) ? null : matching.reduce((sum, database) => sum + database.tableCount, 0);
  };
  return {
    layerTables: { bronze: layerCount('bronze'), silver: layerCount('silver'), gold: layerCount('gold') },
    totalTables: databases.status === 'fulfilled' ? databases.value.filter((database) => !database.systemSchema).reduce((sum, db) => sum + db.tableCount, 0) : null,
    runningJobs: bronze.status === 'fulfilled' && silver.status === 'fulfilled' && gold.status === 'fulfilled'
      ? bronze.value.running + silver.value.running + gold.value.running : null,
    records24h: databases.status === 'fulfilled' && databases.value.some((database) => database.source === 'databricks') ? null : bronze.status === 'fulfilled' && silver.status === 'fulfilled' && gold.status === 'fulfilled'
      ? bronze.value.totalRecordsIngested + silver.value.totalRecordsProcessed + gold.value.totalRecordsProcessed : null,
    activeTopics: kafka.status === 'fulfilled' ? kafka.value.topics : null,
    activeDAGs: airflow.status === 'fulfilled' ? airflow.value.activeDAGs : null,
    qualityScore: dq.status === 'fulfilled' ? dq.value.passRate : null,
    uptimeSeconds: health.status === 'fulfilled' ? health.value.uptime : null,
    totalLag: kafka.status === 'fulfilled' ? kafka.value.totalLag : null,
    systemStatus: health.status === 'fulfilled' ? health.value.status : 'unknown',
    partial: [databases, bronze, silver, gold, kafka, airflow, dq, health].some((result) => result.status === 'rejected'),
  };
}

export function useHomeStatsQuery(options?: Omit<UseQueryOptions<HomeAggregatedStats, Error>, 'queryKey' | 'queryFn'>) {
  return useQuery<HomeAggregatedStats, Error>({
    queryKey: [...QUERY_KEYS.health.all, 'home-stats'], queryFn: fetchHomeStats,
    refetchInterval: 30_000, staleTime: 15_000, ...options,
  });
}
