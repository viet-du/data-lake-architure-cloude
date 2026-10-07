import { describe, it, expect } from 'vitest';
import {
  airflowDAGSchema,
  airflowDAGRunSchema,
  airflowTaskInstanceSchema,
  airflowStatsSchema,
  dagStateSchema,
} from '../airflow';

describe('airflow schema', () => {
  describe('dagStateSchema', () => {
    it('accepts the four states', () => {
      for (const s of ['success', 'failed', 'running', 'queued']) {
        expect(dagStateSchema.parse(s)).toBe(s);
      }
    });

    it('rejects unknown states', () => {
      expect(() => dagStateSchema.parse('pending')).toThrow();
    });
  });

  describe('airflowDAGSchema', () => {
    const baseDag = {
      dagId: 'retail_elt_daily',
      isActive: true,
      isPaused: false,
      tags: ['retail', 'elt'],
      ownerLinks: { airflow: 'https://airflow.local' },
      status: 'healthy' as const,
    };

    it('accepts a minimal DAG', () => {
      expect(airflowDAGSchema.parse(baseDag).dagId).toBe(baseDag.dagId);
    });

    it('rejects empty dagId', () => {
      expect(() => airflowDAGSchema.parse({ ...baseDag, dagId: '' })).toThrow();
    });
  });

  describe('airflowDAGRunSchema', () => {
    it('accepts a run with required fields', () => {
      const run = {
        runId: 'manual__2026-01-15T10:00:00+00:00',
        dagId: 'retail_elt_daily',
        state: 'success' as const,
        executionDate: '2026-01-15T10:00:00Z',
        triggeredBy: 'manual' as const,
      };
      expect(airflowDAGRunSchema.parse(run).state).toBe('success');
    });

    it('rejects unknown triggeredBy', () => {
      expect(() =>
        airflowDAGRunSchema.parse({
          runId: 'r1',
          dagId: 'd1',
          state: 'queued',
          executionDate: '2026-01-15T10:00:00Z',
          triggeredBy: 'cron',
        }),
      ).toThrow();
    });
  });

  describe('airflowTaskInstanceSchema', () => {
    it('accepts a task with try=0', () => {
      const t = {
        taskId: 'extract',
        runId: 'r1',
        state: 'success' as const,
        tryNumber: 0,
        operator: 'SparkSubmitOperator',
        dependencies: [],
      };
      expect(airflowTaskInstanceSchema.parse(t).tryNumber).toBe(0);
    });

    it('rejects negative tryNumber', () => {
      expect(() =>
        airflowTaskInstanceSchema.parse({
          taskId: 'extract',
          runId: 'r1',
          state: 'success',
          tryNumber: -1,
          operator: 'X',
          dependencies: [],
        }),
      ).toThrow();
    });
  });

  describe('airflowStatsSchema', () => {
    it('accepts a valid stats payload', () => {
      const s = {
        totalDAGs: 10,
        activeDAGs: 7,
        pausedDAGs: 3,
        totalRuns: 100,
        runningRuns: 2,
        failedRuns24h: 1,
        successRate24h: 0.95,
      };
      expect(airflowStatsSchema.parse(s).successRate24h).toBe(0.95);
    });

    it('rejects successRate out of [0,1]', () => {
      expect(() =>
        airflowStatsSchema.parse({
          totalDAGs: 0,
          activeDAGs: 0,
          pausedDAGs: 0,
          totalRuns: 0,
          runningRuns: 0,
          failedRuns24h: 0,
          successRate24h: 1.5,
        }),
      ).toThrow();
    });
  });
});
