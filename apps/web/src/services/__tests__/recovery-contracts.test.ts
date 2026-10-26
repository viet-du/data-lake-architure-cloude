import { describe, it, expect, vi, afterEach } from 'vitest';
import { decodeHealth } from '../health/health.service';
import { decodeDatabases, decodeTables } from '../catalog/catalog.adapter';
import { decodeLayerList, decodeJobs } from '../lake';
import { decodeSummary } from '../dq/dq.adapter';
import { decodeKafkaStats } from '../kafka/kafka.adapter';
import { decodeAirflowStats } from '../airflow/airflow.adapter';
import { buildHomeQuickStats, HOME_MODULES } from '@/screens/home/home.constants';
import { getErrorMessage } from '../api';
import { AxiosError } from 'axios';
import type { DashboardMetric, EDashboardMetricStatus } from '@/types/entities';

const timestamp = '2026-10-20T00:00:00Z';

/** A metric object, as the read model delivers it. */
function metric(
  value: number | null,
  status: EDashboardMetricStatus = value === null ? 'unavailable' : 'ok',
): DashboardMetric {
  return { value, status, source: 'test', window: 'all-time', asOf: timestamp, coverage: null };
}

afterEach(() => vi.restoreAllMocks());
describe('actual backend response contracts', () => {
  it('maps health statuses, names, skipped checks and milliseconds', () => {
    const result = decodeHealth({ status: 'down', timestamp, uptime: 65000, services: [{ name: 'MongoDB', status: 'down', latencyMs: 20 }, { name: 'Kafka', status: 'skipped' }] });
    expect(result.status).toBe('unhealthy');
    expect(result.uptime).toBe(65);
    expect(result.services.map((s) => s.status)).toEqual(['unhealthy','unknown']);
    expect(result.services[0]?.name).toBe('MongoDB');
    expect(() => decodeHealth({ status: 'healthy' })).toThrow();
  });
  it('maps multi-layer databases and table metadata without fabricated size', () => {
    const [db] = decodeDatabases([{ database: 'retail', layers: ['bronze','gold'], tableCount: 2, description: null, createdAt: timestamp, updatedAt: timestamp }]);
    expect(db?.layers).toEqual(['bronze','gold']);
    expect(db?.name).toBe('retail');
    expect(decodeTables([{ tableId: 'gold.retail.orders', database: 'retail', name: 'orders', layer: 'gold', sizeBytes: 22, rowCount: 3, lastModified: timestamp }])[0]?.id).toBe('gold.retail.orders');
  });
  it('preserves the qualified identifier used for details and actions', () => {
    expect(decodeLayerList([{ table: 'retail.orders', database: 'retail', name: 'orders' }]).items[0]?.name).toBe('retail.orders');
  });
  it('unwraps job pages and maps completed without inventing row counts', () => {
    const [job] = decodeJobs({ total: 1, items: [{ jobId: 'j1', database: 'retail', table: 'orders', kind: 'csv', status: 'completed', rowCount: 6, bytesProcessed: 30, startedAt: timestamp }] });
    expect(job?.status).toBe('success'); expect(job?.rowCount).toBe(6);
    expect(() => decodeJobs([])).toThrow();
  });
  it('does not display an unexecuted DQ suite as a perfect score', () => {
    const result = decodeSummary({ totalRules: 0, totalRuns: 0, passRate: 1, byStatus: [], recentRuns: [] });
    expect(result.passRate).toBeNull(); expect(result.overallStatus).toBe('unknown');
  });
  it('maps broker and Airflow casing without imaginary rates', () => {
    expect(decodeKafkaStats({ totalTopics: 3, totalPartitions: 5, totalConsumerGroups: 2, totalLag: 4 }).topics).toBe(3);
    expect(decodeAirflowStats({ totalDags: 2, activeDags: 1, pausedDags: 1, runningRuns: 0, failedRuns: 1, successRuns: 2, queuedRuns: 0 }).activeDAGs).toBe(1);
  });
  it('removes fabricated trends/activity and preserves unknown metrics', () => {
    // The cards render *metric objects*, not bare numbers, so the status
    // survives into the UI. A metric that was not measured renders as `—`
    // and keeps its `unavailable` status.
    const stats = buildHomeQuickStats({
      totalTables: metric(0),
      runningJobs: metric(null, 'unavailable'),
      activeTopics: metric(0),
      activeDAGs: metric(null, 'unavailable'),
      recordsProcessed: metric(null, 'unavailable'),
      qualityScore: metric(null, 'not_evaluated'),
      totalLag: metric(null, 'unavailable'),
      uptimeSeconds: null,
    });
    expect(stats[0]?.value).toBe('0');
    expect(stats[0]?.status).toBe('ok');
    expect(stats[1]?.value).toBe('—');
    expect(stats[1]?.status).toBe('unavailable');
    // The quality card keeps "not evaluated" distinct from "unavailable".
    expect(stats.find((s) => s.key === 'quality')?.status).toBe('not_evaluated');
    expect(stats.every((s) => s.delta === undefined)).toBe(true);
    expect(HOME_MODULES.every((m) => m.progress === undefined && m.sparkline === undefined)).toBe(true);
  });
  it('distinguishes transport and HTTP backend errors', () => {
    const network = new AxiosError('Network Error', 'ERR_NETWORK');
    expect(getErrorMessage(network)).not.toBe('Network Error');
    const response = { status: 503, statusText: 'Service Unavailable', data: { error: 'UPSTREAM_DOWN', message: 'Airflow unavailable' }, headers: {}, config: { headers: {} } };
    const error = AxiosError.from(new Error('failed'));
    Object.assign(error, { response });
    expect(getErrorMessage(error)).toBe('Airflow unavailable');
  });
});

describe('Home service failure lifecycle', () => {
  it('keeps unavailable metrics unknown when the dashboard reports a partial read', async () => {
    const services = await import('..');
    vi.spyOn(services.dashboardService, 'getSummary').mockResolvedValue({
      asOf: timestamp,
      scope: 'local_delta_minio',
      metrics: {
        totalTables: { value: null, status: 'unavailable', source: 'catalog', window: 'all-time', asOf: timestamp, coverage: null },
        runningJobs: { value: null, status: 'unavailable', source: 'operations.registry', window: 'live', asOf: timestamp, coverage: null },
        activeTopics: { value: null, status: 'unavailable', source: 'kafka.admin.listTopics', window: 'live', asOf: timestamp, coverage: null },
        activeDAGs: { value: null, status: 'unavailable', source: 'airflow.dags.activeUnpaused', window: 'live', asOf: timestamp, coverage: null },
        recordsProcessed: { value: null, status: 'unavailable', source: 'bronze.jobs.committed', window: 'all-time', asOf: timestamp, coverage: null },
        recordsByStage: {
          bronze: { value: null, status: 'unavailable', source: 'bronze.jobs.committed', window: 'all-time', asOf: timestamp, coverage: null },
          silver: { value: null, status: 'unavailable', source: 'silver.jobs.committed', window: 'all-time', asOf: timestamp, coverage: null },
          gold: { value: null, status: 'unavailable', source: 'gold.jobs.committed', window: 'all-time', asOf: timestamp, coverage: null },
        },
        qualityPassRate: { value: null, status: 'not_evaluated', source: 'dq.runs.passRate', window: 'all-evaluated-runs', asOf: timestamp, coverage: null },
        totalLag: { value: null, status: 'unavailable', source: 'kafka.admin.consumerOffsets', window: 'live', asOf: timestamp, coverage: null },
      },
      serviceHealth: [],
      stageStates: [],
      partialFailures: [{ metric: 'totalTables', reason: 'offline' }],
      partial: true,
      freshnessSeconds: 1,
      systemStatus: null,
      uptimeSeconds: null,
    });
    const { fetchHomeStats } = await import('../queries/home.queries');
    const result = await fetchHomeStats();
    expect(result).toMatchObject({ systemStatus: 'unknown', totalTables: null, runningJobs: null, qualityScore: null, partial: true, uptimeSeconds: null });
  });

  it('does not turn an unevaluated quality metric into a zero pass rate', async () => {
    const services = await import('..');
    vi.spyOn(services.dashboardService, 'getSummary').mockResolvedValue({
      asOf: timestamp,
      scope: 'local_delta_minio',
      metrics: {
        totalTables: { value: 13, status: 'ok', source: 'catalog', window: 'all-time', asOf: timestamp, coverage: 1 },
        runningJobs: { value: 0, status: 'ok', source: 'operations.registry', window: 'live', asOf: timestamp, coverage: 1 },
        activeTopics: { value: 2, status: 'ok', source: 'kafka.admin.listTopics', window: 'live', asOf: timestamp, coverage: 1 },
        activeDAGs: { value: 1, status: 'ok', source: 'airflow.dags.activeUnpaused', window: 'live', asOf: timestamp, coverage: 1 },
        recordsProcessed: { value: 42, status: 'ok', source: 'bronze.jobs.committed', window: 'all-time', asOf: timestamp, coverage: 1 },
        recordsByStage: {
          bronze: { value: 42, status: 'ok', source: 'bronze.jobs.committed', window: 'all-time', asOf: timestamp, coverage: 1 },
          silver: { value: 40, status: 'ok', source: 'silver.jobs.committed', window: 'all-time', asOf: timestamp, coverage: 1 },
          gold: { value: 12, status: 'ok', source: 'gold.jobs.committed', window: 'all-time', asOf: timestamp, coverage: 1 },
        },
        qualityPassRate: { value: null, status: 'not_evaluated', source: 'dq.runs.passRate', window: 'all-evaluated-runs', asOf: timestamp, coverage: 0 },
        totalLag: { value: 0, status: 'ok', source: 'kafka.admin.consumerOffsets', window: 'live', asOf: timestamp, coverage: 1 },
      },
      serviceHealth: [],
      stageStates: [],
      partialFailures: [],
      partial: false,
      freshnessSeconds: 1,
      systemStatus: 'ok',
      uptimeSeconds: 120,
    });
    const { fetchHomeStats } = await import('../queries/home.queries');
    const result = await fetchHomeStats();
    // The unevaluated quality metric stays `null` — never a fake 0% or 100%.
    expect(result.qualityScore).toBeNull();
    // The record count is the Bronze stage's count, never the sum of the
    // three layers (42 + 40 + 12 = 94 would count every row three times).
    expect(result.recordsProcessed).toBe(42);
    expect(result.recordsByStage).toEqual({ bronze: 42, silver: 40, gold: 12 });
    expect(result.systemStatus).toBe('healthy');
  });
});
