import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The denominator of the Home "Quality Pass Rate".
 *
 * HOME-008: a rule run that ended in `error` (unreadable dataset, bad
 * reference) never looked at the data. It used to be counted as an evaluated
 * run, so the only run in the system being an error read as "0% pass rate".
 * "The check could not run" must not look like "the data is bad".
 */

type StatusRow = { _id: string; count: number };

let statusAgg: StatusRow[] = [];
let layerAgg: Array<Record<string, unknown>> = [];

const chain = (rows: unknown[]) => ({
  sort: () => ({ limit: () => ({ lean: async () => rows }) }),
});

vi.mock('@/lib/infra/mongo', () => ({ getMongo: vi.fn(async () => undefined) }));

vi.mock('@/modules/dq/executors', () => ({ DqExecutor: { run: vi.fn() } }));

vi.mock('@/modules/dq/repositories', () => ({
  DqRuleRepository: {},
  DqRunRepository: {},
  DqRuleModel: {
    estimatedDocumentCount: async () => 1,
    countDocuments: async () => 1,
  },
  DqRuleRunModel: {
    find: () => chain([]),
    countDocuments: () => ({ exec: async () => statusAgg.reduce((n, s) => n + s.count, 0) }),
    aggregate: (pipeline: Array<Record<string, any>>) => {
      const group = pipeline.find((stage) => stage.$group)?.$group ?? {};
      if (group._id === '$status') return Promise.resolve(statusAgg);
      if (group._id === '$layer') return Promise.resolve(layerAgg);
      if (group._id === null) {
        return Promise.resolve([{ evaluated: 0, skipped: 0, total: 0 }]);
      }
      return Promise.resolve([]);
    },
  },
}));

import { DqSummaryService } from '@/modules/dq/services/dq.service';

describe('DqSummaryService — pass-rate denominator (HOME-008)', () => {
  beforeEach(() => {
    statusAgg = [];
    layerAgg = [];
  });

  it('is not evaluated when the only run errored', async () => {
    statusAgg = [{ _id: 'error', count: 1 }];
    layerAgg = [
      { _id: 'bronze', total: 1, passed: 0, failed: 0, warned: 0, errored: 1, notEvaluated: 0 },
    ];

    const summary = await DqSummaryService.summary('all');

    expect(summary.passRate).toBeNull();
    expect(summary.status).toBe('error');
    expect(summary.byLayer[0]?.passRate).toBeNull();
  });

  it('is not evaluated when no run exists', async () => {
    const summary = await DqSummaryService.summary('all');

    expect(summary.passRate).toBeNull();
    expect(summary.status).toBe('not_evaluated');
  });

  it('ignores errored runs in the denominator but keeps them in the gate', async () => {
    statusAgg = [
      { _id: 'pass', count: 3 },
      { _id: 'fail', count: 1 },
      { _id: 'error', count: 4 },
    ];
    layerAgg = [
      { _id: 'bronze', total: 8, passed: 3, failed: 1, warned: 0, errored: 4, notEvaluated: 0 },
    ];

    const summary = await DqSummaryService.summary('all');

    expect(summary.passRate).toBeCloseTo(0.75);
    expect(summary.status).toBe('fail');
    expect(summary.byLayer[0]?.passRate).toBeCloseTo(0.75);
  });

  it('reports 100% only when a rule really passed', async () => {
    statusAgg = [
      { _id: 'pass', count: 1 },
      { _id: 'error', count: 1 },
    ];
    layerAgg = [
      { _id: 'bronze', total: 2, passed: 1, failed: 0, warned: 0, errored: 1, notEvaluated: 0 },
    ];

    const summary = await DqSummaryService.summary('all');

    expect(summary.passRate).toBe(1);
    expect(summary.status).toBe('error');
  });
});
