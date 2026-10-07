import { randomUUID } from 'node:crypto';
import { getMongo } from '@/lib/infra/mongo';
import { DqRuleModel, DqRuleRunModel } from './models';
import type { DqRule, DqRuleInput, DqRuleRun, DqRunStatus, DqLayer, DqRunTrigger } from '../types';

async function ensureConnection(): Promise<void> {
  await getMongo();
}

function toIso(value: Date | string | undefined): string {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
}

function ruleFromDoc(doc: Record<string, unknown>): DqRule {
  return {
    ruleId: doc.ruleId as string,
    name: doc.name as string,
    description: (doc.description as string | null | undefined) ?? null,
    type: doc.type as DqRule['type'],
    layer: doc.layer as DqLayer,
    table: doc.table as string,
    column: (doc.column as string | null | undefined) ?? null,
    params: (doc.params as Record<string, unknown>) ?? {},
    severity: doc.severity as DqRule['severity'],
    enabled: (doc.enabled as boolean) ?? true,
    tags: ((doc.tags as string[]) ?? []).slice(),
    createdAt: toIso(doc.createdAt as Date | string | undefined),
    updatedAt: toIso(doc.updatedAt as Date | string | undefined),
  };
}

function ruleRunFromDoc(doc: Record<string, unknown>): DqRuleRun {
  return {
    runId: doc.runId as string,
    ruleId: (doc.ruleId as string | null | undefined) ?? null,
    ruleName: doc.ruleName as string,
    type: doc.type as DqRuleRun['type'],
    layer: doc.layer as DqLayer,
    table: doc.table as string,
    status: doc.status as DqRunStatus,
    trigger: (doc.trigger as DqRunTrigger) ?? 'manual',
    severity: (doc.severity as DqRuleRun['severity']) ?? 'medium',
    totalRows: (doc.totalRows as number) ?? 0,
    failedRows: (doc.failedRows as number) ?? 0,
    passRate: (doc.passRate as number) ?? 0,
    errorMessage: (doc.errorMessage as string | null | undefined) ?? null,
    durationMs: (doc.durationMs as number) ?? 0,
    startedAt: doc.startedAt as string,
    finishedAt: doc.finishedAt as string,
    suiteRunId: (doc.suiteRunId as string | null | undefined) ?? null,
  };
}

export const DqRuleRepository = {
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
    await ensureConnection();
    const query: Record<string, unknown> = {};
    if (filter.layer) query.layer = filter.layer;
    if (filter.type) query.type = filter.type;
    if (filter.enabled !== undefined) query.enabled = filter.enabled;
    if (filter.severity) query.severity = filter.severity;
    if (filter.table) query.table = filter.table;
    if (filter.tag) query.tags = filter.tag;
    const [docs, total] = await Promise.all([
      DqRuleModel.find(query)
        .sort({ updatedAt: -1 })
        .skip(filter.offset)
        .limit(filter.limit)
        .lean(),
      DqRuleModel.countDocuments(query),
    ]);
    return { total, items: docs.map((d) => ruleFromDoc(d as Record<string, unknown>)) };
  },

  async findById(ruleId: string): Promise<DqRule | null> {
    await ensureConnection();
    const doc = await DqRuleModel.findOne({ ruleId }).lean();
    return doc ? ruleFromDoc(doc as Record<string, unknown>) : null;
  },

  async create(input: DqRuleInput): Promise<DqRule> {
    await ensureConnection();
    const ruleId = randomUUID().replace(/-/g, '').slice(0, 24);
    const created = await DqRuleModel.create({
      ruleId,
      name: input.name,
      description: input.description ?? null,
      type: input.type,
      layer: input.layer,
      table: input.table,
      column: input.column ?? null,
      params: input.params,
      severity: input.severity ?? 'medium',
      enabled: input.enabled ?? true,
      tags: input.tags ?? [],
    });
    return ruleFromDoc(created.toObject() as Record<string, unknown>);
  },

  async update(ruleId: string, patch: Partial<DqRuleInput>): Promise<DqRule | null> {
    await ensureConnection();
    const update: Record<string, unknown> = {};
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.description !== undefined) update.description = patch.description;
    if (patch.type !== undefined) update.type = patch.type;
    if (patch.layer !== undefined) update.layer = patch.layer;
    if (patch.table !== undefined) update.table = patch.table;
    if (patch.column !== undefined) update.column = patch.column;
    if (patch.params !== undefined) update.params = patch.params;
    if (patch.severity !== undefined) update.severity = patch.severity;
    if (patch.enabled !== undefined) update.enabled = patch.enabled;
    if (patch.tags !== undefined) update.tags = patch.tags;
    const updated = await DqRuleModel.findOneAndUpdate({ ruleId }, { $set: update }, { new: true }).lean();
    return updated ? ruleFromDoc(updated as Record<string, unknown>) : null;
  },

  async delete(ruleId: string): Promise<boolean> {
    await ensureConnection();
    const res = await DqRuleModel.deleteOne({ ruleId });
    return res.deletedCount > 0;
  },
};

export const DqRunRepository = {
  async list(filter: {
    ruleId?: string;
    layer?: DqLayer;
    status?: DqRunStatus;
    trigger?: DqRunTrigger;
    suiteRunId?: string;
    limit: number;
    offset: number;
  }): Promise<{ total: number; items: DqRuleRun[] }> {
    await ensureConnection();
    const query: Record<string, unknown> = {};
    if (filter.ruleId) query.ruleId = filter.ruleId;
    if (filter.layer) query.layer = filter.layer;
    if (filter.status) query.status = filter.status;
    if (filter.trigger) query.trigger = filter.trigger;
    if (filter.suiteRunId) query.suiteRunId = filter.suiteRunId;
    const [docs, total] = await Promise.all([
      DqRuleRunModel.find(query)
        .sort({ startedAt: -1 })
        .skip(filter.offset)
        .limit(filter.limit)
        .lean(),
      DqRuleRunModel.countDocuments(query),
    ]);
    return { total, items: docs.map((d) => ruleRunFromDoc(d as Record<string, unknown>)) };
  },

  async findById(runId: string): Promise<DqRuleRun | null> {
    await ensureConnection();
    const doc = await DqRuleRunModel.findOne({ runId }).lean();
    return doc ? ruleRunFromDoc(doc as Record<string, unknown>) : null;
  },

  async findSuiteRuns(suiteRunId: string): Promise<DqRuleRun[]> {
    await ensureConnection();
    const docs = await DqRuleRunModel.find({ suiteRunId }).sort({ startedAt: 1 }).lean();
    return docs.map((d) => ruleRunFromDoc(d as Record<string, unknown>));
  },

  async insertRun(run: Omit<DqRuleRun, 'runId'> & { runId?: string }): Promise<DqRuleRun> {
    await ensureConnection();
    const runId = run.runId ?? randomUUID().replace(/-/g, '').slice(0, 24);
    const created = await DqRuleRunModel.create({ ...run, runId });
    return ruleRunFromDoc(created.toObject() as Record<string, unknown>);
  },
};