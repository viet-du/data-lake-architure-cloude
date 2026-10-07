import { describe, it, expect } from 'vitest';

import {
  TableListQuerySchema,
  SampleQuerySchema,
  VacuumBodySchema,
} from '@/modules/bronze/schemas/table.schema';
import { IngestCsvBodySchema } from '@/modules/bronze/schemas/ingest.schema';

describe('bronze — Zod schemas', () => {
  it('TableListQuerySchema defaults offset=0', () => {
    const parsed = TableListQuerySchema.parse({});
    expect(parsed.offset).toBe(0);
  });

  it('IngestCsvBodySchema requires database, table, source', () => {
    expect(() => IngestCsvBodySchema.parse({})).toThrow();
    const ok = IngestCsvBodySchema.parse({
      database: 'ecommerce',
      table: 'orders',
      source: 'http://minio:9000/x.csv',
    });
    expect(ok.database).toBe('ecommerce');
    expect(ok.options.header).toBe(true);
  });

  it('IngestCsvBodySchema rejects uppercase table', () => {
    expect(() =>
      IngestCsvBodySchema.parse({
        database: 'ecommerce',
        table: 'UPPER',
        source: 'http://x',
      }),
    ).toThrow();
  });

  it('SampleQuerySchema default limit=100', () => {
    const parsed = SampleQuerySchema.parse({});
    expect(parsed.limit).toBe(100);
  });

  it('VacuumBodySchema default retentionDays=7 dryRun=false', () => {
    const parsed = VacuumBodySchema.parse({});
    expect(parsed.retentionDays).toBe(7);
    expect(parsed.dryRun).toBe(false);
  });
});