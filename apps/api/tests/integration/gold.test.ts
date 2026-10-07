import { describe, it, expect } from 'vitest';

import { TableListQuerySchema } from '@/modules/gold/schemas/table.schema';
import {
  AggregateBodySchema,
  AggregateAllBodySchema,
} from '@/modules/gold/schemas/aggregate.schema';

describe('gold — Zod schemas', () => {
  it('TableListQuerySchema defaults offset=0', () => {
    const parsed = TableListQuerySchema.parse({});
    expect(parsed.offset).toBe(0);
  });

  it('AggregateBodySchema defaults kind=full', () => {
    const parsed = AggregateBodySchema.parse({});
    expect(parsed.kind).toBe('full');
    expect(parsed.qualityChecks).toBe(true);
  });

  it('AggregateBodySchema validates sourceTables pattern', () => {
    expect(() =>
      AggregateBodySchema.parse({ sourceTables: ['UPPERCASE'] }),
    ).toThrow();
    const ok = AggregateBodySchema.parse({ sourceTables: ['silver_orders_clean'] });
    expect(ok.sourceTables).toEqual(['silver_orders_clean']);
  });

  it('AggregateAllBodySchema defaults kind=full parallel=4', () => {
    const parsed = AggregateAllBodySchema.parse({});
    expect(parsed.kind).toBe('full');
    expect(parsed.parallel).toBe(4);
  });

  it('AggregateAllBodySchema rejects parallel > 16', () => {
    expect(() => AggregateAllBodySchema.parse({ parallel: 100 })).toThrow();
  });
});