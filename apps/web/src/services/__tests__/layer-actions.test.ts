import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../api';
import { bronzeService } from '../bronze';
import { silverService } from '../silver';
import { goldService } from '../gold';
import { IngestCsvBodySchema, IngestJsonBodySchema } from '../../../../api/src/modules/bronze/schemas/ingest.schema';
import { TransformBodySchema } from '../../../../api/src/modules/silver/schemas/transform.schema';
import { AggregateBodySchema } from '../../../../api/src/modules/gold/schemas/aggregate.schema';

afterEach(() => { vi.restoreAllMocks(); });

const queuedJob = {
  jobId: 'fixture', database: 'retail', table: 'orders', kind: 'full', status: 'queued',
  rowCount: 0, bytesProcessed: 0, startedAt: '2026-10-21T00:00:00Z',
};

describe('layer action contracts without external writes', () => {
  it.each(['csv', 'json'] as const)('submits a valid %s source and retains queued rather than execution success', async (kind) => {
    const payload = { database: 'retail', table: 'orders', source: `s3://fixture/orders.${kind}` };
    expect((kind === 'csv' ? IngestCsvBodySchema : IngestJsonBodySchema).safeParse(payload).success).toBe(true);
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { data: { ...queuedJob, kind } } });
    const job = await (kind === 'csv' ? bronzeService.ingestCsv(payload) : bronzeService.ingestJson(payload));
    expect(post).toHaveBeenCalledWith(`/api/bronze/ingest/${kind}`, payload);
    expect(job.status).toBe('queued');
  });
  it('validates the Silver request against the backend schema and preserves qualified table identifiers', async () => {
    const payload = { kind: 'full', sourceTable: 'raw_orders' } as const;
    expect(TransformBodySchema.safeParse(payload).success).toBe(true);
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { data: queuedJob } });
    expect((await silverService.transform('retail.orders', payload)).status).toBe('queued');
    expect(post).toHaveBeenCalledWith('/api/silver/retail.orders/transform', payload);
  });
  it('validates Gold source tables against the backend schema and propagates rejection', async () => {
    const payload = { kind: 'full', sourceTables: ['orders', 'customers'] } as const;
    expect(AggregateBodySchema.safeParse(payload).success).toBe(true);
    vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('worker unavailable'));
    await expect(goldService.aggregate('retail.daily', payload)).rejects.toThrow('worker unavailable');
  });
});
