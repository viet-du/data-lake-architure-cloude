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
it('counts business tables separately from information_schema without inventing processed-record metrics', async () => {
  const services = await import('..');
  const base = { catalogName: 'workspace', source: 'databricks' as const, updatedAt: null };
  vi.spyOn(services.catalogService, 'listDatabases').mockResolvedValue([
    { ...base, id: 'bronze', name: 'workspace.bronze', layers: ['bronze'], tableCount: 3 },
    { ...base, id: 'silver', name: 'workspace.silver', layers: ['silver'], tableCount: 5 },
    { ...base, id: 'gold', name: 'workspace.gold', layers: ['gold'], tableCount: 3 },
    { ...base, id: 'raw', name: 'workspace.raw_elt', layers: [], tableCount: 2 },
    { ...base, id: 'system', name: 'workspace.information_schema', layers: [], tableCount: 29, systemSchema: true },
  ]);
  vi.spyOn(services.bronzeService, 'getJobStats').mockRejectedValue(new Error('separate service'));
  vi.spyOn(services.silverService, 'getJobStats').mockRejectedValue(new Error('separate service'));
  vi.spyOn(services.goldService, 'getJobStats').mockRejectedValue(new Error('separate service'));
  vi.spyOn(services.kafkaService, 'getStats').mockRejectedValue(new Error('separate service'));
  vi.spyOn(services.airflowService, 'getStats').mockRejectedValue(new Error('separate service'));
  vi.spyOn(services.dqService, 'getSummary').mockRejectedValue(new Error('separate service'));
  vi.spyOn(services.healthService, 'getHealth').mockRejectedValue(new Error('separate service'));
  const { fetchHomeStats } = await import('../queries/home.queries');
  expect(await fetchHomeStats()).toMatchObject({ totalTables: 13, layerTables: { bronze: 3, silver: 5, gold: 3 }, records24h: null });
});
