import { describe, it, expect } from 'vitest';

import {
  TableListQuerySchema,
  TimeTravelParamsSchema,
  DiffParamsSchema,
  TimeTravelQuerySchema,
} from '@/modules/silver/schemas/table.schema';

describe('silver — Zod schemas', () => {
  it('TableListQuerySchema defaults offset=0', () => {
    const parsed = TableListQuerySchema.parse({});
    expect(parsed.offset).toBe(0);
  });

  it('TimeTravelParamsSchema requires version >= 0', () => {
    expect(() => TimeTravelParamsSchema.parse({ table: 'x', version: -1 })).toThrow();
    const ok = TimeTravelParamsSchema.parse({ table: 'x', version: 0 });
    expect(ok.version).toBe(0);
  });

  it('DiffParamsSchema requires v1/v2', () => {
    expect(() => DiffParamsSchema.parse({ table: 'x' })).toThrow();
    const ok = DiffParamsSchema.parse({ table: 'x', v1: 3, v2: 5 });
    expect(ok.v1).toBe(3);
    expect(ok.v2).toBe(5);
  });

  it('TimeTravelQuerySchema default limit=100', () => {
    const parsed = TimeTravelQuerySchema.parse({});
    expect(parsed.limit).toBe(100);
  });
});