import { describe, it, expect } from 'vitest';

import {
  DagIdParamSchema,
  DagListQuerySchema,
  TriggerDagBodySchema,
  RunIdParamSchema,
  RunsListQuerySchema,
} from '@/modules/airflow/schemas/airflow.schema';

describe('airflow — Zod schemas', () => {
  it('DagIdParamSchema rejects spaces and slashes', () => {
    expect(() => DagIdParamSchema.parse({ dagId: 'has space' })).toThrow();
    expect(() => DagIdParamSchema.parse({ dagId: 'has/slash' })).toThrow();
    const ok = DagIdParamSchema.parse({ dagId: 'retail_elt' });
    expect(ok.dagId).toBe('retail_elt');
  });

  it('DagListQuerySchema defaults limit=100', () => {
    const parsed = DagListQuerySchema.parse({});
    expect(parsed.limit).toBe(100);
    expect(parsed.offset).toBe(0);
  });

  it('TriggerDagBodySchema defaults conf to {}', () => {
    const ok = TriggerDagBodySchema.parse({});
    expect(ok.conf).toEqual({});
  });

  it('RunIdParamSchema requires both dagId and runId', () => {
    expect(() => RunIdParamSchema.parse({ dagId: 'x' })).toThrow();
    const ok = RunIdParamSchema.parse({ dagId: 'x', runId: 'manual__2025' });
    expect(ok.runId).toBe('manual__2025');
  });

  it('RunsListQuerySchema rejects invalid state', () => {
    expect(() => RunsListQuerySchema.parse({ state: 'unknown' })).toThrow();
    const ok = RunsListQuerySchema.parse({ state: 'success', limit: 10 });
    expect(ok.state).toBe('success');
  });
});