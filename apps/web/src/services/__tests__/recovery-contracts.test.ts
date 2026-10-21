import { describe, it, expect, vi, afterEach } from 'vitest';
import { decodeHealth } from '../health/health.service';
import { decodeDatabases, decodeTables } from '../catalog/catalog.adapter';
import { decodeLayerList, decodeJobs } from '../lake';
import { decodeSummary } from '../dq/dq.adapter';
import { decodeKafkaStats } from '../kafka/kafka.adapter';
import { decodeAirflowStats } from '../airflow/airflow.adapter';
import { buildHomeQuickStats, HOME_ACTIVITY, HOME_MODULES } from '@/screens/home/home.constants';
import { getErrorMessage } from '../api';
import { AxiosError } from 'axios';

const timestamp = '2026-10-20T00:00:00Z';
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
    const stats = buildHomeQuickStats({ totalTables: 0, runningJobs: null, activeTopics: 0, activeDAGs: null, records24h: null, qualityScore: null, totalLag: null, uptimeSeconds: null });
    expect(stats[0]?.value).toBe('0'); expect(stats[1]?.value).toBe('—');
    expect(stats.every((s) => s.delta === undefined)).toBe(true);
    expect(HOME_ACTIVITY).toEqual([]); expect(HOME_MODULES.every((m) => m.progress === undefined && m.sparkline === undefined)).toBe(true);
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
  it('keeps unavailable metrics unknown when all services fail', async () => {
    const services = await import('..');
    vi.spyOn(services.catalogService, 'listDatabases').mockRejectedValue(new Error('offline'));
    vi.spyOn(services.bronzeService, 'getJobStats').mockRejectedValue(new Error('offline'));
    vi.spyOn(services.silverService, 'getJobStats').mockRejectedValue(new Error('offline'));
    vi.spyOn(services.goldService, 'getJobStats').mockRejectedValue(new Error('offline'));
    vi.spyOn(services.kafkaService, 'getStats').mockRejectedValue(new Error('offline'));
    vi.spyOn(services.airflowService, 'getStats').mockRejectedValue(new Error('offline'));
    vi.spyOn(services.dqService, 'getSummary').mockRejectedValue(new Error('offline'));
    vi.spyOn(services.healthService, 'getHealth').mockRejectedValue(new Error('offline'));
    const { fetchHomeStats } = await import('../queries/home.queries');
    const result = await fetchHomeStats();
    expect(result).toMatchObject({ systemStatus: 'unknown', totalTables: null, runningJobs: null, qualityScore: null, partial: true, uptimeSeconds: null });
  });
});
