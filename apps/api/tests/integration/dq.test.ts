import { describe, it, expect } from 'vitest';

import {
  RuleIdParamSchema,
  CreateRuleBodySchema,
  UpdateRuleBodySchema,
  RuleListQuerySchema,
  RunRuleBodySchema,
  RunSuiteBodySchema,
} from '@/modules/dq/schemas/dq.schema';

describe('dq — Zod schemas', () => {
  it('RuleIdParamSchema rejects special chars', () => {
    expect(() => RuleIdParamSchema.parse({ ruleId: 'has space' })).toThrow();
    expect(() => RuleIdParamSchema.parse({ ruleId: 'has/slash' })).toThrow();
    const ok = RuleIdParamSchema.parse({ ruleId: 'orders_not_null' });
    expect(ok.ruleId).toBe('orders_not_null');
  });

  it('CreateRuleBodySchema requires name, type, layer, table', () => {
    expect(() => CreateRuleBodySchema.parse({})).toThrow();
    const ok = CreateRuleBodySchema.parse({
      name: 'orders id not null',
      type: 'null_check',
      layer: 'bronze',
      table: 'ecommerce/orders',
      column: 'order_id',
      params: { maxNullPercent: 0 },
    });
    expect(ok.severity).toBe('medium');
    expect(ok.enabled).toBe(true);
  });

  it('UpdateRuleBodySchema is strict (extra keys rejected)', () => {
    expect(() =>
      UpdateRuleBodySchema.parse({ name: 'x', unknownKey: 'y' }),
    ).toThrow();
  });

  it('RuleListQuerySchema defaults limit=100', () => {
    const parsed = RuleListQuerySchema.parse({});
    expect(parsed.limit).toBe(100);
  });

  it('RunRuleBodySchema default limit=1000 sampleSize=10', () => {
    const parsed = RunRuleBodySchema.parse({});
    expect(parsed.limit).toBe(1000);
    expect(parsed.sampleSize).toBe(10);
  });

  it('RunSuiteBodySchema requires ruleIds min 1', () => {
    expect(() => RunSuiteBodySchema.parse({ ruleIds: [] })).toThrow();
    const ok = RunSuiteBodySchema.parse({ ruleIds: ['a', 'b'] });
    expect(ok.ruleIds).toHaveLength(2);
  });
});