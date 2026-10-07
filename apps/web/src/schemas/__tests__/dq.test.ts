import { describe, it, expect } from 'vitest';
import {
  dqRuleSchema,
  dqRuleCreatePayloadSchema,
  dqRunSchema,
  dqSummarySchema,
  dqSeveritySchema,
} from '../dq';

describe('dq schema', () => {
  describe('dqSeveritySchema', () => {
    it('accepts the four severities', () => {
      for (const s of ['low', 'medium', 'high', 'critical']) {
        expect(dqSeveritySchema.parse(s)).toBe(s);
      }
    });

    it('rejects unknown severities', () => {
      expect(() => dqSeveritySchema.parse('urgent')).toThrow();
    });
  });

  describe('dqRuleSchema', () => {
    const baseRule = {
      ruleId: 'r1',
      tableName: 'silver.orders',
      ruleName: 'order_id not null',
      ruleType: 'not_null' as const,
      severity: 'high' as const,
      status: 'pass' as const,
      expression: 'order_id IS NOT NULL',
      enabled: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-15T10:00:00Z',
    };

    it('accepts a valid rule', () => {
      expect(dqRuleSchema.parse(baseRule).ruleId).toBe('r1');
    });

    it('rejects empty expression', () => {
      expect(() =>
        dqRuleSchema.parse({ ...baseRule, expression: '' }),
      ).toThrow();
    });
  });

  describe('dqRuleCreatePayloadSchema', () => {
    it('requires tableName, ruleName, ruleType, severity, expression', () => {
      expect(() => dqRuleCreatePayloadSchema.parse({})).toThrow();
    });

    it('accepts a minimal payload', () => {
      const out = dqRuleCreatePayloadSchema.parse({
        tableName: 'silver.orders',
        ruleName: 'x not null',
        ruleType: 'not_null',
        severity: 'high',
        expression: 'x IS NOT NULL',
      });
      expect(out.tableName).toBe('silver.orders');
    });
  });

  describe('dqRunSchema', () => {
    it('accepts a successful run', () => {
      const r = {
        runId: 'run-1',
        status: 'success' as const,
        startedAt: '2026-01-15T10:00:00Z',
        passedRules: 10,
        failedRules: 0,
        warningRules: 1,
        totalCheckedRows: 1000,
      };
      expect(dqRunSchema.parse(r).passedRules).toBe(10);
    });

    it('rejects negative passedRules', () => {
      expect(() =>
        dqRunSchema.parse({
          runId: 'r',
          status: 'success',
          startedAt: '2026-01-15T10:00:00Z',
          passedRules: -1,
          failedRules: 0,
          warningRules: 0,
          totalCheckedRows: 0,
        }),
      ).toThrow();
    });
  });

  describe('dqSummarySchema', () => {
    it('accepts a valid summary', () => {
      const s = {
        totalRules: 10,
        passing: 8,
        failing: 1,
        warning: 1,
        overallStatus: 'degraded' as const,
        bySeverity: { low: 3, medium: 4, high: 2, critical: 1 },
      };
      expect(dqSummarySchema.parse(s).passing).toBe(8);
    });

    it('rejects unknown status', () => {
      expect(() =>
        dqSummarySchema.parse({
          totalRules: 0,
          passing: 0,
          failing: 0,
          warning: 0,
          overallStatus: 'yellow',
          bySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
        }),
      ).toThrow();
    });
  });
});
