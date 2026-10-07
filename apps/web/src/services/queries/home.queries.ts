import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { QUERY_KEYS } from '../query-keys';
import { bronzeService, silverService, goldService, kafkaService, airflowService, dqService, healthService } from '..';
import type { EHealthStatus } from '@/types/commons';
import type {
  BronzeJobsStats,
  SilverJobsStats,
  GoldJobsStats,
  KafkaStats,
  AirflowStats,
  DQSummary,
  HealthResponse,
} from '@/types/entities';

export interface HomeAggregatedStats {
  totalTables: number;
  runningJobs: number;
  activeTopics: number;
  activeDAGs: number;
  records24h: number;
  qualityScore: number;
  uptimeSeconds: number;
  totalLag: number;
  systemStatus: EHealthStatus;
}

function toNumber(value: number | string | undefined, fallback: number = 0): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

export function useHomeStatsQuery(
  options?: Omit<UseQueryOptions<HomeAggregatedStats, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<HomeAggregatedStats, Error>({
    queryKey: [...QUERY_KEYS.health.all, 'home-stats'],
    queryFn: async () => {
      const [
        bronzeStats,
        silverStats,
        goldStats,
        kafkaStats,
        airflowStats,
        dqSummary,
        health,
      ] = await Promise.allSettled([
        bronzeService.getJobStats(),
        silverService.getJobStats(),
        goldService.getJobStats(),
        kafkaService.getStats(),
        airflowService.getStats(),
        dqService.getSummary(),
        healthService.getHealth(),
      ]);

      const bronze = bronzeStats.status === 'fulfilled' ? (bronzeStats.value as BronzeJobsStats) : null;
      const silver = silverStats.status === 'fulfilled' ? (silverStats.value as SilverJobsStats) : null;
      const gold = goldStats.status === 'fulfilled' ? (goldStats.value as GoldJobsStats) : null;
      const kafka = kafkaStats.status === 'fulfilled' ? (kafkaStats.value as KafkaStats) : null;
      const airflow = airflowStats.status === 'fulfilled' ? (airflowStats.value as AirflowStats) : null;
      const dq = dqSummary.status === 'fulfilled' ? (dqSummary.value as DQSummary) : null;
      const healthValue = health.status === 'fulfilled' ? (health.value as HealthResponse) : null;

      const runningJobs =
        toNumber(bronze?.running) + toNumber(silver?.running) + toNumber(gold?.running);

      const records24h =
        toNumber(bronze?.totalRecordsIngested) +
        toNumber(silver?.totalRecordsProcessed) +
        toNumber(gold?.totalRecordsProcessed);

      const totalTables = 0;

      return {
        totalTables,
        runningJobs,
        activeTopics: toNumber(kafka?.topics),
        activeDAGs: toNumber(airflow?.activeDAGs),
        records24h,
        qualityScore: dq === null ? 0 : Math.round(
          (dq.passing / Math.max(1, dq.passing + dq.failing + dq.warning)) * 100,
        ),
        uptimeSeconds: toNumber(healthValue?.uptime),
        totalLag: toNumber(kafka?.totalLag),
        systemStatus: healthValue?.status ?? 'healthy',
      } satisfies HomeAggregatedStats;
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
    ...options,
  });
}
