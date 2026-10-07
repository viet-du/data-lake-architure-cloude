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

export const DQ_RUN_STATUS = ['pass', 'fail', 'error'] as const;
export type DqRunStatus = (typeof DQ_RUN_STATUS)[number];

export const DQ_RUN_TRIGGER = ['manual', 'suite', 'scheduled'] as const;
export type DqRunTrigger = (typeof DQ_RUN_TRIGGER)[number];

export const DQ_SEVERITY = ['low', 'medium', 'high', 'critical'] as const;
export type DqSeverity = (typeof DQ_SEVERITY)[number];