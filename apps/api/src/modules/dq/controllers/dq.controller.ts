import {
  DqRuleService,
  DqExecutionService,
  DqRunService,
} from '../services/dq.service';
import { DqPresetService, DqPresetCatalogueService } from '../services/preset.service';
import { redactSamples } from '../services/sample-redaction.service';
import type { DqRule, DqRuleInput, DqRuleRun, DqSuiteRun } from '../types';
import type {
  TRuleIdParam,
  TRunIdParam,
  TCreateRuleBody,
  TUpdateRuleBody,
  TRuleListQuery,
  TRunRuleBody,
  TRunSuiteBody,
  TRunsListQuery,
  TPresetIdParam,
  TPresetTarget,
} from '../schemas';

export const DqRuleController = {
  async list(query: TRuleListQuery): Promise<{ total: number; items: DqRule[] }> {
    return DqRuleService.list({
      limit: query.limit,
      offset: query.offset,
      ...(query.layer !== undefined ? { layer: query.layer } : {}),
      ...(query.type !== undefined ? { type: query.type } : {}),
      ...(query.enabled !== undefined ? { enabled: query.enabled } : {}),
      ...(query.severity !== undefined ? { severity: query.severity } : {}),
      ...(query.table !== undefined ? { table: query.table } : {}),
      ...(query.tag !== undefined ? { tag: query.tag } : {}),
    });
  },

  async get(params: TRuleIdParam): Promise<DqRule> {
    return DqRuleService.get(params.ruleId);
  },

  async create(body: TCreateRuleBody): Promise<DqRule> {
    return DqRuleService.create({
      name: body.name,
      ...(body.description !== undefined ? { description: body.description } : {}),
      type: body.type,
      layer: body.layer,
      table: body.table,
      ...(body.column !== undefined ? { column: body.column } : {}),
      params: body.params,
      ...(body.severity !== undefined ? { severity: body.severity } : {}),
      ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
      ...(body.tags !== undefined ? { tags: body.tags } : {}),
    });
  },

  async update(params: TRuleIdParam, body: TUpdateRuleBody): Promise<DqRule> {
    const patch: Partial<DqRuleInput> = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.description !== undefined && body.description !== null) patch.description = body.description;
    if (body.type !== undefined) patch.type = body.type;
    if (body.layer !== undefined) patch.layer = body.layer;
    if (body.table !== undefined) patch.table = body.table;
    if (body.column !== undefined && body.column !== null) patch.column = body.column;
    if (body.params !== undefined) patch.params = body.params;
    if (body.severity !== undefined) patch.severity = body.severity;
    if (body.enabled !== undefined) patch.enabled = body.enabled;
    if (body.tags !== undefined) patch.tags = body.tags;
    return DqRuleService.update(params.ruleId, patch);
  },

  async remove(params: TRuleIdParam): Promise<{ ruleId: string; deleted: boolean }> {
    return DqRuleService.delete(params.ruleId);
  },

  async run(params: TRuleIdParam, body: TRunRuleBody): Promise<DqRuleRun> {
    return DqExecutionService.runRule(params.ruleId, {
      ...(body.partition !== undefined ? { partition: body.partition } : {}),
      ...(body.runId !== undefined ? { runId: body.runId } : {}),
      limit: body.limit,
      sampleSize: body.sampleSize,
    });
  },
};

export const DqRunController = {
  async runSuite(body: TRunSuiteBody): Promise<DqSuiteRun> {
    return DqExecutionService.runSuite({
      name: body.name,
      ruleIds: body.ruleIds,
      ...(body.partition !== undefined ? { partition: body.partition } : {}),
      limit: body.limit,
      sampleSize: body.sampleSize,
    });
  },

  async list(query: TRunsListQuery): Promise<{ total: number; items: DqRuleRun[] }> {
    return DqRunService.list({
      limit: query.limit,
      offset: query.offset,
      ...(query.ruleId !== undefined ? { ruleId: query.ruleId } : {}),
      ...(query.layer !== undefined ? { layer: query.layer } : {}),
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.trigger !== undefined ? { trigger: query.trigger } : {}),
      ...(query.suiteRunId !== undefined ? { suiteRunId: query.suiteRunId } : {}),
    });
  },

  async get(params: TRunIdParam): Promise<DqRuleRun> {
    return DqRunService.get(params.runId);
  },

  /**
   * The redacted failed samples of a run.
   *
   * MASTER PLAN §06.5: only representative failed samples are returned, the
   * cap is bounded (1–100) and PII is redacted before the rows leave the
   * server. The rows are never returned raw.
   */
  async samples(params: TRunIdParam, limit: number): Promise<{
    runId: string;
    ruleId: string | null;
    status: DqRuleRun['status'];
    total: number;
    returned: number;
    truncated: boolean;
    columns: string[];
    rows: Array<Record<string, unknown>>;
  }> {
    const run = await DqRunService.get(params.runId);
    const stored = run.sampleFailures ?? [];
    const rows = redactSamples(stored, limit);
    const columns = rows.length > 0 ? Object.keys(rows[0] ?? {}) : [];
    return {
      runId: run.runId,
      ruleId: run.ruleId,
      status: run.status,
      total: stored.length,
      returned: rows.length,
      truncated: stored.length > rows.length,
      columns,
      rows,
    };
  },
};

/**
 * The preset wizard controller.
 *
 * MASTER PLAN DQ-009: the preset is checked against the dataset schema and
 * applied idempotently to the confirmed dataset/column.
 */
export const DqPresetController = {
  async check(
    params: TPresetIdParam,
    target: TPresetTarget,
  ): Promise<Awaited<ReturnType<typeof DqPresetService.check>>> {
    const preset = await DqPresetCatalogueService.get(params.presetId);
    return DqPresetService.check(preset, target);
  },

  async apply(
    params: TPresetIdParam,
    target: TPresetTarget,
    options: { severity?: 'low' | 'medium' | 'high' | 'critical'; enabled?: boolean },
  ): Promise<Awaited<ReturnType<typeof DqPresetService.apply>>> {
    const preset = await DqPresetCatalogueService.get(params.presetId);
    return DqPresetService.apply(preset, target, options);
  },
};