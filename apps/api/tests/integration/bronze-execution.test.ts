import { describe, it, expect } from 'vitest';

describe('unfinished ingestion executors', () => {
  it('cannot mark a no-op CSV ingestion successful', async () => {
    const { processCsvIngest } = await import('@/modules/bronze/workers/ingest-csv.worker');
    await expect(processCsvIngest({ jobId: 'test', database: 'retail', table: 'orders', kind: 'csv', source: 'test.csv', startedAt: '2026-10-20T00:00:00Z' })).rejects.toThrow('no data was written');
  });
  it('cannot mark a no-op JSON ingestion successful', async () => {
    const { processJsonIngest } = await import('@/modules/bronze/workers/ingest-json.worker');
    await expect(processJsonIngest({ jobId: 'test', database: 'retail', table: 'orders', kind: 'json', source: 'test.json', startedAt: '2026-10-20T00:00:00Z' })).rejects.toThrow('no data was written');
  });
  it('cannot mark a no-op stream ingestion successful', async () => {
    const { processStreamIngest } = await import('@/modules/bronze/workers/ingest-stream.worker');
    await expect(processStreamIngest({ jobId: 'test', database: 'retail', table: 'orders', kind: 'stream', topic: 'test', startedAt: '2026-10-20T00:00:00Z' })).rejects.toThrow('no data was written');
  });
});
