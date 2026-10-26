export const DQ_RULE_TYPE = [
  'null_check',
  'range_check',
  'in_set',
  'unique',
  'regex',
  'custom_sql',
] as const;
export type DqRuleType = (typeof DQ_RULE_TYPE)[number];

export const DQ_LAYER = ['bronze', 'silver', 'gold'] as const;
export type DqLayer = (typeof DQ_LAYER)[number];

/**
 * Rule run outcomes.
 *
 * MASTER PLAN §06.1 DQ-007 / DQ-010: a technical error is NOT a pass and
 * NOT a fail — it is an unknown outcome. `not_evaluated` means the rule was
 * never executed (no rules / no run yet), which must never be rendered as a
 * 100% pass rate.
 */
export const DQ_RUN_STATUS = ['pass', 'fail', 'warn', 'error', 'not_evaluated'] as const;
export type DqRunStatus = (typeof DQ_RUN_STATUS)[number];

export const DQ_RUN_TRIGGER = ['manual', 'suite', 'scheduled'] as const;
export type DqRunTrigger = (typeof DQ_RUN_TRIGGER)[number];

export const DQ_SEVERITY = ['low', 'medium', 'high', 'critical'] as const;
export type DqSeverity = (typeof DQ_SEVERITY)[number];

/** Quality gate outcome — mirrors the operation quality gate vocabulary. */
export const DQ_GATE_OUTCOME = ['pass', 'fail', 'warn', 'error', 'not_evaluated'] as const;
export type DqGateOutcome = (typeof DQ_GATE_OUTCOME)[number];
