import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeDatabase, decodeTable } from '../catalog/catalog.adapter';
import { decodeLayerDetail, decodeTableStats } from '../lake';

describe('Databricks native catalog contracts', () => {
  it('preserves non-medallion schemas and unknown metadata', () => {
    expect(decodeDatabase({ database: 'workspace.raw_elt', catalogName: 'workspace', layers: [], tableCount: 2, description: null, createdAt: null, updatedAt: null })).toMatchObject({ catalogName: 'workspace', layers: [], tableCount: 2 });
    expect(decodeTable({ tableId: 'workspace.raw_elt.events', database: 'workspace.raw_elt', name: 'events', layer: null, format: 'view', sizeBytes: null, rowCount: null, lastModified: null })).toMatchObject({ id: 'workspace.raw_elt.events', layer: null, format: 'view', rowCount: null, sizeBytes: null });
  });
  it('preserves remote detail row counts and does not fabricate file sizes', () => {
    expect(decodeLayerDetail({ table: 'workspace.bronze.orders', database: 'workspace', name: 'orders', rowCount: 42, sizeBytes: null, lastModified: null, partitions: [] })).toMatchObject({ name: 'workspace.bronze.orders', rowCount: 42, sizeBytes: null });
    expect(decodeTableStats({ table: 'workspace.bronze.orders', rowCount: 42, sizeBytes: null, fileCount: null, partitionCount: 0 }).avgFileSizeBytes).toBeNull();
  });
});

it('marks system schemas separately from business inventory', () => {
  const system = decodeDatabase({ database: 'workspace.information_schema', catalogName: 'workspace', source: 'databricks', systemSchema: true, layers: [], tableCount: 29, description: null, createdAt: null, updatedAt: null });
  expect(system.systemSchema).toBe(true);
  expect(system.source).toBe('databricks');
});


afterEach(() => { vi.restoreAllMocks(); });
it('reads the dashboard summary instead of re-deriving per-layer counters in the browser', async () => {
  const services = await import('..');
  vi.spyOn(services.dashboardService, 'getSummary').mockResolvedValue({
    asOf: '2026-10-20T00:00:00Z',
    scope: 'databricks_uc',
    metrics: {
      totalTables: { value: 13, status: 'ok', source: 'catalog:databricks_uc', window: 'all-time', asOf: '2026-10-20T00:00:00Z', coverage: 1 },
      runningJobs: { value: 0, status: 'ok', source: 'operations.registry', window: 'live', asOf: '2026-10-20T00:00:00Z', coverage: 1 },
      activeTopics: { value: 0, status: 'ok', source: 'kafka.admin.listTopics', window: 'live', asOf: '2026-10-20T00:00:00Z', coverage: 1 },
      activeDAGs: { value: 0, status: 'ok', source: 'airflow.dags.activeUnpaused', window: 'live', asOf: '2026-10-20T00:00:00Z', coverage: 1 },
      recordsProcessed: { value: null, status: 'unavailable', source: 'bronze.jobs.committed', window: 'all-time', asOf: '2026-10-20T00:00:00Z', coverage: null, reason: 'No Bronze ingestion job has committed yet.' },
      recordsByStage: {
        bronze: { value: null, status: 'unavailable', source: 'bronze.jobs.committed', window: 'all-time', asOf: '2026-10-20T00:00:00Z', coverage: null },
        silver: { value: null, status: 'unavailable', source: 'silver.jobs.committed', window: 'all-time', asOf: '2026-10-20T00:00:00Z', coverage: null },
        gold: { value: null, status: 'unavailable', source: 'gold.jobs.committed', window: 'all-time', asOf: '2026-10-20T00:00:00Z', coverage: null },
      },
      qualityPassRate: { value: null, status: 'not_evaluated', source: 'dq.runs.passRate', window: 'all-evaluated-runs', asOf: '2026-10-20T00:00:00Z', coverage: 0 },
      totalLag: { value: 0, status: 'ok', source: 'kafka.admin.consumerOffsets', window: 'live', asOf: '2026-10-20T00:00:00Z', coverage: 1 },
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
  expect(result).toMatchObject({ totalTables: 13, scope: 'databricks_uc', recordsProcessed: null, qualityScore: null });
});
