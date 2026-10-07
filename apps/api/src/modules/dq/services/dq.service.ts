import {
  DqRuleRepository,
  DqRunRepository,
  DqRuleModel,
  DqRuleRunModel,
} from '../repositories';
import { getMongo } from '@/lib/infra/mongo';
import { DqExecutor } from '../executors';
import type {
  DqRule,
  DqRuleInput,
  DqRuleRun,
  DqSuiteRun,
  DqSummary,
  DqPreset,
  DqLayer,
  DqRunStatus,
  DqRunTrigger,
} from '../types';
import { AppError } from '@/errors';

async function ensureConnection(): Promise<void> {
  await getMongo();
}

const DQ_PRESETS: DqPreset[] = [
  {
    presetId: 'bronze-orders-not-null',
    name: 'Bronze orders: required fields not null',
    description: 'Check critical fields (order_id, customer_id, total_amount) are never NULL in bronze orders',
    layer: 'bronze',
    tableHint: 'orders',
    type: 'null_check',
    params: { maxNullPercent: 0 },
    severity: 'critical',
    tags: ['bronze', 'orders', 'not-null', 'pii'],
  },
  {
    presetId: 'bronze-events-no-totally-empty',
    name: 'Bronze events: at least one field non-null',
    description: 'Detect fully empty rows in bronze events stream',
    layer: 'bronze',
    tableHint: 'events',
    type: 'null_check',
    params: { maxNullPercent: 0 },
    severity: 'medium',
    tags: ['bronze', 'events'],
  },
  {
    presetId: 'silver-dedupe-by-id',
    name: 'Silver dedupe by id',
    description: 'Ensure primary id column is unique in silver tables',
    layer: 'silver',
    tableHint: '*',
    type: 'unique',
    params: {},
    severity: 'high',
    tags: ['silver', 'dedupe'],
  },
  {
    presetId: 'silver-status-in-set',
    name: 'Silver status whitelist',
    description: 'Status field must be one of allowed values',
    layer: 'silver',
    tableHint: '*',
    type: 'in_set',
    params: { values: ['pending', 'active', 'completed', 'cancelled', 'refunded'] },
    severity: 'medium',
    tags: ['silver', 'enum'],
  },
  {
    presetId: 'gold-amount-range',
    name: 'Gold amount range',
    description: 'Gold aggregated amount must be >= 0',
    layer: 'gold',
    tableHint: '*',
    type: 'range_check',
    params: { min: 0 },
    severity: 'high',
    tags: ['gold', 'finance'],
  },
  {
    presetId: 'gold-email-regex',
    name: 'Gold email regex',
    description: 'Email column must match RFC-ish pattern',
    layer: 'gold',
    tableHint: '*',
    type: 'regex',
    params: { pattern: '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$' },
    severity: 'medium',
    tags: ['gold', 'pii'],
  },
];

export const DqRuleService = {
  async list(filter: {
    layer?: DqLayer;
    type?: DqRule['type'];
    enabled?: boolean;
    severity?: DqRule['severity'];
    table?: string;
    tag?: string;
    limit: number;
    offset: number;
  }): Promise<{ total: number; items: DqRule[] }> {
    return DqRuleRepository.list(filter);
  },

  async get(ruleId: string): Promise<DqRule> {
    const rule = await DqRuleRepository.findById(ruleId);
    if (!rule) {
      throw new AppError(404, 'RULE_NOT_FOUND', `Rule not found: ${ruleId}`);
    }
    return rule;
  },

  async create(input: DqRuleInput): Promise<DqRule> {
    return DqRuleRepository.create(input);
  },

  async update(ruleId: string, patch: Partial<DqRuleInput>): Promise<DqRule> {
    const updated = await DqRuleRepository.update(ruleId, patch);
    if (!updated) {
      throw new AppError(404, 'RULE_NOT_FOUND', `Rule not found: ${ruleId}`);
    }
    return updated;
  },

  async delete(ruleId: string): Promise<{ ruleId: string; deleted: boolean }> {
    const ok = await DqRuleRepository.delete(ruleId);
    if (!ok) {
      throw new AppError(404, 'RULE_NOT_FOUND', `Rule not found: ${ruleId}`);
    }
    return { ruleId, deleted: true };
  },
};

export const DqExecutionService = {
  async runRule(
    ruleId: string,
    options: { partition?: string; runId?: string; limit: number; sampleSize: number },
  ): Promise<DqRuleRun> {
    const rule = await DqRuleService.get(ruleId);
    if (!rule.enabled) {
      throw new AppError(400, 'RULE_DISABLED', `Rule is disabled: ${ruleId}`);
    }
    return this.executeOne(rule, 'manual', options.runId ?? null, {
      ...(options.partition !== undefined ? { partition: options.partition } : {}),
      limit: options.limit,
      sampleSize: options.sampleSize,
    });
  },

  async runSuite(options: {
    name: string;
    ruleIds: string[];
    partition?: string;
    limit: number;
    sampleSize: number;
  }): Promise<DqSuiteRun> {
    const suiteStartedAt = Date.now();
    const rules: DqRule[] = [];
    for (const id of options.ruleIds) {
      const r = await DqRuleRepository.findById(id);
      if (r && r.enabled) rules.push(r);
    }
    if (rules.length === 0) {
      throw new AppError(400, 'NO_ENABLED_RULES', 'No enabled rules found for suite');
    }
    const suiteRunId = `suite-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const ruleRuns: DqRuleRun[] = [];
    for (const rule of rules) {
      const run = await this.executeOne(rule, 'suite', suiteRunId, {
        ...(options.partition !== undefined ? { partition: options.partition } : {}),
        limit: options.limit,
        sampleSize: options.sampleSize,
      });
      ruleRuns.push(run);
    }
    const finishedAt = Date.now();
    const totalRules = ruleRuns.length;
    const passedRules = ruleRuns.filter((r) => r.status === 'pass').length;
    const failedRules = ruleRuns.filter((r) => r.status === 'fail').length;
    const erroredRules = ruleRuns.filter((r) => r.status === 'error').length;
    const totalRows = ruleRuns.reduce((sum, r) => sum + r.totalRows, 0);
    const failedRows = ruleRuns.reduce((sum, r) => sum + r.failedRows, 0);
    const passRate = totalRows > 0 ? 1 - failedRows / totalRows : 1;
    return {
      runId: suiteRunId,
      name: options.name,
      trigger: 'suite',
      totalRules,
      passedRules,
      failedRules,
      erroredRules,
      totalRows,
      failedRows,
      passRate,
      startedAt: new Date(suiteStartedAt).toISOString(),
      finishedAt: new Date(finishedAt).toISOString(),
      durationMs: finishedAt - suiteStartedAt,
      ruleRuns,
    };
  },

  async executeOne(
    rule: DqRule,
    trigger: DqRunTrigger,
    suiteRunId: string | null,
    options: { partition?: string; limit: number; sampleSize: number },
  ): Promise<DqRuleRun> {
    const startedAt = Date.now();
    const execution = await DqExecutor.run(rule, options);
    const finishedAt = Date.now();
    const run = await DqRunRepository.insertRun({
      runId: execution.runId,
      ruleId: rule.ruleId,
      ruleName: rule.name,
      type: rule.type,
      layer: rule.layer,
      table: rule.table,
      status: execution.status,
      trigger,
      severity: rule.severity,
      totalRows: execution.totalRows,
      failedRows: execution.failedRows,
      passRate: execution.passRate,
      errorMessage: execution.errorMessage,
      durationMs: execution.durationMs,
      startedAt: new Date(startedAt).toISOString(),
      finishedAt: new Date(finishedAt).toISOString(),
      suiteRunId,
    });
    return run;
  },
};

export const DqRunService = {
  async list(filter: {
    ruleId?: string;
    layer?: DqLayer;
    status?: DqRunStatus;
    trigger?: DqRunTrigger;
    suiteRunId?: string;
    limit: number;
    offset: number;
  }): Promise<{ total: number; items: DqRuleRun[] }> {
    return DqRunRepository.list(filter);
  },

  async get(runId: string): Promise<DqRuleRun> {
    const run = await DqRunRepository.findById(runId);
    if (!run) {
      throw new AppError(404, 'RUN_NOT_FOUND', `Run not found: ${runId}`);
    }
    return run;
  },
};

export const DqSummaryService = {
  async summary(): Promise<DqSummary> {
    await ensureConnection();
    const [totalRules, enabledRules, recentRuns, statusAgg, layerAgg, topFailed] = await Promise.all([
      DqRuleModel.estimatedDocumentCount(),
      DqRuleModel.countDocuments({ enabled: true }),
      DqRuleRunModel.find().sort({ startedAt: -1 }).limit(10).lean(),
      DqRuleRunModel.aggregate<{ _id: DqRunStatus; count: number }>([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      DqRuleRunModel.aggregate<{ _id: DqLayer; total: number; passed: number; failed: number }>([
        {
          $group: {
            _id: '$layer',
            total: { $sum: 1 },
            passed: { $sum: { $cond: [{ $eq: ['$status', 'pass'] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ['$status', 'fail'] }, 1, 0] } },
          },
        },
      ]),
      DqRuleRunModel.aggregate<{ _id: string; ruleName: string; failCount: number; passRate: number }>([
        { $match: { status: { $in: ['fail', 'error'] }, ruleId: { $ne: null } } },
        {
          $group: {
            _id: '$ruleId',
            ruleName: { $first: '$ruleName' },
            failCount: { $sum: 1 },
            passRate: { $avg: '$passRate' },
          },
        },
        { $sort: { failCount: -1 } },
        { $limit: 10 },
      ]),
    ]);
    const totalRuns = recentRuns.length > 0 ? await DqRuleRunModel.estimatedDocumentCount() : 0;
    const recentItems = recentRuns.map((d: Record<string, unknown>) => ({
      runId: d.runId as string,
      ruleId: (d.ruleId as string | null) ?? null,
      ruleName: d.ruleName as string,
      type: d.type as DqRuleRun['type'],
      layer: d.layer as DqLayer,
      table: d.table as string,
      status: d.status as DqRunStatus,
      trigger: (d.trigger as DqRunTrigger) ?? 'manual',
      severity: (d.severity as DqRuleRun['severity']) ?? 'medium',
      totalRows: (d.totalRows as number) ?? 0,
      failedRows: (d.failedRows as number) ?? 0,
      passRate: (d.passRate as number) ?? 0,
      errorMessage: (d.errorMessage as string | null) ?? null,
      durationMs: (d.durationMs as number) ?? 0,
      startedAt: d.startedAt as string,
      finishedAt: d.finishedAt as string,
      suiteRunId: (d.suiteRunId as string | null) ?? null,
    }));
    const passCount = statusAgg.find((s) => s._id === 'pass')?.count ?? 0;
    const totalAgg = statusAgg.reduce((sum, s) => sum + s.count, 0);
    const passRate = totalAgg > 0 ? passCount / totalAgg : 1;
    return {
      totalRules,
      enabledRules,
      totalRuns,
      passRate,
      byLayer: layerAgg.map((l) => ({
        layer: l._id,
        total: l.total,
        passed: l.passed,
        failed: l.failed,
        passRate: l.total > 0 ? l.passed / l.total : 1,
      })),
      byStatus: statusAgg.map((s) => ({ status: s._id, count: s.count })),
      topFailedRules: topFailed.map((t) => ({
        ruleId: t._id,
        ruleName: t.ruleName,
        failCount: t.failCount,
        passRate: t.passRate,
      })),
      recentRuns: recentItems,
    };
  },

  async presets(): Promise<{ total: number; items: DqPreset[] }> {
    return { total: DQ_PRESETS.length, items: DQ_PRESETS };
  },
};