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
  DqGateOutcome,
} from '../types';
import { AppError } from '@/errors';

async function ensureConnection(): Promise<void> {
  await getMongo();
}

export const DQ_PRESETS: DqPreset[] = [
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
    const warnedRules = ruleRuns.filter((r) => r.status === 'warn').length;
    const erroredRules = ruleRuns.filter((r) => r.status === 'error').length;
    const totalRows = ruleRuns.reduce((sum, r) => sum + r.totalRows, 0);
    const failedRows = ruleRuns.reduce((sum, r) => sum + r.failedRows, 0);
    const evaluatedRows = ruleRuns.reduce((sum, r) => sum + r.evaluatedRows, 0);
    const skippedRows = ruleRuns.reduce((sum, r) => sum + r.skippedRows, 0);
    // MASTER PLAN §06.4: two different pass rates.
    // 1) rule-execution pass rate — a technical ERROR is never a pass.
    const evaluatedRuleRuns = ruleRuns.filter((r) => r.status !== 'error' && r.status !== 'not_evaluated');
    const passRate =
      evaluatedRuleRuns.length > 0 ? passedRules / evaluatedRuleRuns.length : null;
    // 2) record validity rate — denominator is the evaluated record checks.
    const recordValidityRate = evaluatedRows > 0 ? 1 - failedRows / evaluatedRows : null;
    // DQ-007: with 0 evaluated rules the gate is NOT_EVALUATED, never "pass".
    const gateOutcome: DqGateOutcome =
      evaluatedRuleRuns.length === 0
        ? 'not_evaluated'
        : failedRules > 0
          ? 'fail'
          : erroredRules > 0
            ? 'error'
            : warnedRules > 0
              ? 'warn'
              : 'pass';
    return {
      runId: suiteRunId,
      name: options.name,
      trigger: 'suite',
      totalRules,
      passedRules,
      failedRules,
      warnedRules,
      erroredRules,
      totalRows,
      failedRows,
      evaluatedRows,
      skippedRows,
      passRate,
      recordValidityRate,
      gateOutcome,
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
      evaluatedRows: execution.evaluatedRows,
      skippedRows: execution.skippedRows,
      passRate: execution.passRate,
      coverageRate: execution.coverageRate,
      errorMessage: execution.errorMessage,
      durationMs: execution.durationMs,
      startedAt: new Date(startedAt).toISOString(),
      finishedAt: new Date(finishedAt).toISOString(),
      suiteRunId,
      sampleFailures: execution.sampleFailures,
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

/**
 * The measurement window of the quality summary.
 *
 * MASTER PLAN §06.4/§08.1 require the quality figure to state its window
 * and never to mix windows. `all` is every evaluated run; `24h` is the
 * rolling last day.
 */
export type DqSummaryWindow = 'all' | '24h';

const DQ_WINDOW_HOURS: Readonly<Record<DqSummaryWindow, number | null>> = {
  all: null,
  '24h': 24,
};

export const DqSummaryService = {
  async summary(window: DqSummaryWindow = 'all'): Promise<DqSummary> {
    await ensureConnection();

    // The window bounds the *runs* that are counted. A window that is not
    // requested is `all` — the honest default is every evaluated run, not
    // an arbitrary slice.
    const hours = DQ_WINDOW_HOURS[window] ?? null;

    // The bound is an ISO **string**, not a `Date`.
    //
    // `dq_runs.startedAt` is declared as `type: String`, so the stored value
    // is a string. Comparing a string field against a BSON `Date` matches
    // **nothing**: MongoDB orders BSON types, and every `Date` sorts before
    // every `String`. The 24-hour window therefore used to return an empty
    // population — a pass rate of `null` ("not evaluated") for a pipeline
    // that had evaluated hundreds of rules that day.
    //
    // ISO-8601 sorts chronologically as plain text, so a lexicographic
    // comparison is exact and needs no date casting.
    const since =
      hours === null ? null : new Date(Date.now() - hours * 3_600_000).toISOString();

    // The window applies to every aggregation that counts runs, so the
    // pass rate, the per-layer breakdown and the per-status counts all
    // describe the same set of runs.
    const runMatch = since === null ? {} : { startedAt: { $gte: since } };

    const [totalRules, enabledRules, recentRuns, statusAgg, layerAgg, topFailed] = await Promise.all([
      DqRuleModel.estimatedDocumentCount(),
      DqRuleModel.countDocuments({ enabled: true }),
      DqRuleRunModel.find(runMatch).sort({ startedAt: -1 }).limit(10).lean(),
      DqRuleRunModel.aggregate<{ _id: DqRunStatus; count: number }>([
        { $match: runMatch },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      DqRuleRunModel.aggregate<{
        _id: DqLayer;
        total: number;
        passed: number;
        failed: number;
        warned: number;
        errored: number;
        notEvaluated: number;
      }>([
        { $match: runMatch },
        {
          $group: {
            _id: '$layer',
            total: { $sum: 1 },
            passed: { $sum: { $cond: [{ $eq: ['$status', 'pass'] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ['$status', 'fail'] }, 1, 0] } },
            warned: { $sum: { $cond: [{ $eq: ['$status', 'warn'] }, 1, 0] } },
            errored: { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } },
            notEvaluated: { $sum: { $cond: [{ $eq: ['$status', 'not_evaluated'] }, 1, 0] } },
          },
        },
      ]),
      DqRuleRunModel.aggregate<{
        _id: string;
        ruleName: string;
        failCount: number;
        passRate: number | null;
      }>([
        { $match: { ...runMatch, status: { $in: ['fail', 'error'] }, ruleId: { $ne: null } } },
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
    // The number of runs **in the window**.
    //
    // It used to be `estimatedDocumentCount()`, which counts the *whole*
    // collection and ignores the window entirely — so a "last 24 hours"
    // summary reported an all-time run count next to a 24-hour pass rate.
    // Two different populations in one response, which is exactly what the
    // window contract forbids.
    const totalRuns = await DqRuleRunModel.countDocuments(runMatch).exec();
    // The denominator of the quality gate — MASTER PLAN §06.4: a pass rate
    // without its denominator is meaningless, so the summary reports the
    // evaluated rows and the skipped (NULL-column) rows explicitly.
    const denominatorAgg = await DqRuleRunModel.aggregate<{
      evaluated: number;
      skipped: number;
      total: number;
    }>([
      { $match: runMatch },
      {
        $group: {
          _id: null,
          evaluated: { $sum: { $ifNull: ['$evaluatedRows', 0] } },
          skipped: { $sum: { $ifNull: ['$skippedRows', 0] } },
          total: { $sum: { $ifNull: ['$totalRows', 0] } },
        },
      },
    ]);
    const denominator = denominatorAgg[0] ?? { evaluated: 0, skipped: 0, total: 0 };
    const coverageRate =
      denominator.total > 0 ? denominator.evaluated / denominator.total : null;
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
      evaluatedRows: (d.evaluatedRows as number) ?? 0,
      skippedRows: (d.skippedRows as number) ?? 0,
      passRate: (d.passRate as number | null | undefined) ?? null,
      coverageRate: (d.coverageRate as number) ?? 0,
      errorMessage: (d.errorMessage as string | null) ?? null,
      durationMs: (d.durationMs as number) ?? 0,
      startedAt: d.startedAt as string,
      finishedAt: d.finishedAt as string,
      suiteRunId: (d.suiteRunId as string | null) ?? null,
    }));
    const passCount = statusAgg.find((s) => s._id === 'pass')?.count ?? 0;
    // DQ-007 / MASTER PLAN §06.4: an unevaluated dataset must NOT render as 100%.
    // `passRate` stays `null` (rendered as "Not evaluated") until at least one
    // rule has actually been evaluated.
    //
    // A run that ended in `error` (dataset unreadable, bad reference, engine
    // failure) never looked at the data, so it is neither a pass nor a fail.
    // Counting it in the denominator turned "the check could not run" into a
    // 0% pass rate on Home (HOME-008). It stays visible through `byStatus`
    // and the gate `status`, but it is not evidence about data quality.
    const evaluatedAgg = statusAgg
      .filter((s) => s._id !== 'not_evaluated' && s._id !== 'error')
      .reduce((sum, s) => sum + s.count, 0);
    const passRate = evaluatedAgg > 0 ? passCount / evaluatedAgg : null;
    const failCount = statusAgg.find((s) => s._id === 'fail')?.count ?? 0;
    const warnCount = statusAgg.find((s) => s._id === 'warn')?.count ?? 0;
    const errorCount = statusAgg.find((s) => s._id === 'error')?.count ?? 0;
    // Gate outcome for the global summary (MASTER PLAN §06.4).
    const status: DqGateOutcome =
      evaluatedAgg === 0
        ? errorCount > 0
          ? 'error'
          : 'not_evaluated'
        : failCount > 0
          ? 'fail'
          : errorCount > 0
            ? 'error'
            : warnCount > 0
              ? 'warn'
              : 'pass';
    return {
      totalRules,
      enabledRules,
      totalRuns,
      passRate,
      status,
      evaluatedRows: denominator.evaluated,
      skippedRows: denominator.skipped,
      coverageRate,
      byLayer: layerAgg.map((l) => {
        // Same denominator as the global rate: a run that errored never
        // looked at the data, so it is not evidence either way.
        const layerEvaluated = l.total - l.notEvaluated - l.errored;
        return {
          layer: l._id,
          total: l.total,
          passed: l.passed,
          failed: l.failed,
          warned: l.warned,
          errored: l.errored,
          notEvaluated: l.notEvaluated,
          evaluated: layerEvaluated,
          passRate: layerEvaluated > 0 ? l.passed / layerEvaluated : null,
        };
      }),
      byStatus: statusAgg.map((s) => ({ status: s._id, count: s.count })),
      topFailedRules: topFailed.map((t) => ({
        ruleId: t._id,
        ruleName: t.ruleName,
        failCount: t.failCount,
        passRate: t.passRate ?? null,
      })),
      recentRuns: recentItems,
    };
  },

  async presets(): Promise<{ total: number; items: DqPreset[] }> {
    return { total: DQ_PRESETS.length, items: DQ_PRESETS };
  },
};