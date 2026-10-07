import { getMongo } from '@/lib/infra/mongo';
import { CrawlerRunModel, CrawlerConfigModel, type CrawlerRunDoc, type CrawlerConfigDoc } from './models';
import type {
  CrawlerName,
  CrawlerRun,
  CrawlerRunStatus,
  CrawlerRunSummary,
  CrawlerItem,
  CrawlerItemStatus,
  CrawlerConfig,
  CrawlerRunRequest,
} from '../types';
import { CrawlerConfigBodySchema } from '../schemas';

type ItemShape = {
  id: string;
  status: CrawlerItemStatus;
  payload: Record<string, unknown>;
  error?: string;
  crawledAt: string;
};

type RunShape = {
  runId: string;
  crawler: CrawlerName;
  status: CrawlerRunStatus;
  requestedBy: string | null | undefined;
  request: {
    category: string | null | undefined;
    maxPages: number;
    language: string | null | undefined;
    since: 'daily' | 'weekly' | 'monthly' | null | undefined;
    dryRun: boolean;
  };
  startedAt: string;
  finishedAt: string | null | undefined;
  durationMs: number | null | undefined;
  items: ItemShape[];
  stats: { total: number; success: number; failed: number; skipped: number };
  errorMessage: string | null | undefined;
  parentJobId: string | null | undefined;
  createdAt: Date;
  updatedAt: Date;
};

function toRunPlain(doc: CrawlerRunDoc | null): RunShape | null {
  if (!doc) return null;
  const d = doc as unknown as {
    runId: string;
    crawler: string;
    status: string;
    requestedBy?: string;
    request: {
      category?: string;
      maxPages: number;
      language?: string;
      since?: 'daily' | 'weekly' | 'monthly';
      dryRun: boolean;
    };
    startedAt: string;
    finishedAt?: string;
    durationMs?: number;
    items?: ItemShape[];
    stats: { total: number; success: number; failed: number; skipped: number };
    errorMessage?: string;
    parentJobId?: string;
    createdAt: Date;
    updatedAt: Date;
  };
  return {
    runId: d.runId,
    crawler: d.crawler as CrawlerName,
    status: d.status as CrawlerRunStatus,
    requestedBy: d.requestedBy,
    request: {
      category: d.request?.category,
      maxPages: d.request?.maxPages ?? 5,
      language: d.request?.language,
      since: d.request?.since,
      dryRun: d.request?.dryRun ?? false,
    },
    startedAt: d.startedAt,
    finishedAt: d.finishedAt,
    durationMs: d.durationMs,
    items: d.items ?? [],
    stats: d.stats ?? { total: 0, success: 0, failed: 0, skipped: 0 },
    errorMessage: d.errorMessage,
    parentJobId: d.parentJobId,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

function runToEntity(plain: RunShape): CrawlerRun {
  return {
    runId: plain.runId,
    crawler: plain.crawler,
    status: plain.status,
    ...(plain.requestedBy ? { requestedBy: plain.requestedBy } : {}),
    request: {
      ...(plain.request.category ? { category: plain.request.category } : {}),
      maxPages: plain.request.maxPages,
      ...(plain.request.language ? { language: plain.request.language } : {}),
      ...(plain.request.since ? { since: plain.request.since } : {}),
      dryRun: plain.request.dryRun,
    },
    startedAt: plain.startedAt,
    ...(plain.finishedAt ? { finishedAt: plain.finishedAt } : {}),
    ...(plain.durationMs !== null && plain.durationMs !== undefined
      ? { durationMs: plain.durationMs }
      : {}),
    items: plain.items,
    stats: plain.stats,
    ...(plain.errorMessage ? { errorMessage: plain.errorMessage } : {}),
    ...(plain.parentJobId ? { parentJobId: plain.parentJobId } : {}),
  };
}

function runToSummary(plain: RunShape): CrawlerRunSummary {
  return {
    runId: plain.runId,
    crawler: plain.crawler,
    status: plain.status,
    startedAt: plain.startedAt,
    ...(plain.finishedAt ? { finishedAt: plain.finishedAt } : {}),
    ...(plain.durationMs !== null && plain.durationMs !== undefined
      ? { durationMs: plain.durationMs }
      : {}),
    itemsTotal: plain.stats.total,
    itemsSuccess: plain.stats.success,
    itemsFailed: plain.stats.failed,
    itemsSkipped: plain.stats.skipped,
    dryRun: plain.request.dryRun,
  };
}

const DEFAULT_CONFIG: CrawlerConfig = {
  rateLimit: 1.0,
  maxRetries: 3,
  timeout: 30,
  maxWorkers: 8,
  kafkaTopic: null,
  userAgent: 'LakehouseCrawler/1.0',
};

export const CrawlerRunRepository = {
  async ensureConnection(): Promise<void> {
    await getMongo();
  },

  async create(input: {
    runId: string;
    crawler: CrawlerName;
    request: CrawlerRunRequest;
    requestedBy?: string;
    parentJobId?: string;
  }): Promise<CrawlerRun> {
    await this.ensureConnection();
    const startedAt = new Date().toISOString();
    const doc = await CrawlerRunModel.create({
      runId: input.runId,
      crawler: input.crawler,
      status: 'queued',
      request: {
        ...(input.request.category ? { category: input.request.category } : {}),
        maxPages: input.request.maxPages,
        ...(input.request.language ? { language: input.request.language } : {}),
        ...(input.request.since ? { since: input.request.since } : {}),
        dryRun: input.request.dryRun,
      },
      startedAt,
      items: [],
      stats: { total: 0, success: 0, failed: 0, skipped: 0 },
      ...(input.requestedBy ? { requestedBy: input.requestedBy } : {}),
      ...(input.parentJobId ? { parentJobId: input.parentJobId } : {}),
    });
    const plain = toRunPlain(doc.toObject() as unknown as CrawlerRunDoc);
    return runToEntity(plain as RunShape);
  },

  async findByRunId(crawler: CrawlerName, runId: string): Promise<CrawlerRun | null> {
    await this.ensureConnection();
    const doc = await CrawlerRunModel.findOne({ runId, crawler })
      .lean<CrawlerRunDoc>()
      .exec();
    const plain = toRunPlain(doc as unknown as CrawlerRunDoc);
    if (!plain) return null;
    return runToEntity(plain);
  },

  async findSummary(crawler: CrawlerName, runId: string): Promise<CrawlerRunSummary | null> {
    await this.ensureConnection();
    const doc = await CrawlerRunModel.findOne({ runId, crawler })
      .lean<CrawlerRunDoc>()
      .exec();
    const plain = toRunPlain(doc as unknown as CrawlerRunDoc);
    if (!plain) return null;
    return runToSummary(plain);
  },

  async update(runId: string, patch: Partial<CrawlerRun>): Promise<CrawlerRun | null> {
    await this.ensureConnection();
    const set: Record<string, unknown> = {};
    if (patch.status !== undefined) set.status = patch.status;
    if (patch.finishedAt !== undefined) set.finishedAt = patch.finishedAt;
    if (patch.durationMs !== undefined) set.durationMs = patch.durationMs;
    if (patch.errorMessage !== undefined) set.errorMessage = patch.errorMessage;
    if (patch.items !== undefined) set.items = patch.items;
    if (patch.stats !== undefined) set.stats = patch.stats;
    const doc = await CrawlerRunModel.findOneAndUpdate(
      { runId },
      { $set: set },
      { new: true },
    )
      .lean<CrawlerRunDoc>()
      .exec();
    const plain = toRunPlain(doc as unknown as CrawlerRunDoc);
    if (!plain) return null;
    return runToEntity(plain);
  },

  async list(crawler: CrawlerName, filter: {
    status?: CrawlerRunStatus;
    limit: number;
    offset: number;
  }): Promise<{ total: number; items: CrawlerRunSummary[] }> {
    await this.ensureConnection();
    const q: Record<string, unknown> = { crawler };
    if (filter.status) q.status = filter.status;
    const [docs, total] = await Promise.all([
      CrawlerRunModel.find(q)
        .sort({ startedAt: -1 })
        .skip(filter.offset)
        .limit(filter.limit)
        .lean<CrawlerRunDoc[]>()
        .exec(),
      CrawlerRunModel.countDocuments(q).exec(),
    ]);
    const summaries: CrawlerRunSummary[] = docs
      .map((d) => toRunPlain(d))
      .filter((p): p is RunShape => p !== null)
      .map(runToSummary);
    return { total, items: summaries };
  },

  async listItems(
    crawler: CrawlerName,
    runId: string,
    filter: { status?: CrawlerItemStatus; limit: number; offset: number },
  ): Promise<{ total: number; items: CrawlerItem[] }> {
    await this.ensureConnection();
    const doc = await CrawlerRunModel.findOne({ runId, crawler })
      .lean<CrawlerRunDoc>()
      .exec();
    const plain = toRunPlain(doc as unknown as CrawlerRunDoc);
    if (!plain) return { total: 0, items: [] };
    const allItems: CrawlerItem[] = plain.items.map((i) => ({
      id: i.id,
      status: i.status,
      payload: i.payload,
      ...(i.error ? { error: i.error } : {}),
      crawledAt: i.crawledAt,
    }));
    const filtered = filter.status
      ? allItems.filter((i) => i.status === filter.status)
      : allItems;
    return {
      total: filtered.length,
      items: filtered.slice(filter.offset, filter.offset + filter.limit),
    };
  },

  async statsByCrawler(): Promise<
    {
      _id: CrawlerName;
      totalRuns: number;
      successRuns: number;
      failedRuns: number;
      cancelledRuns: number;
      totalItems: number;
      totalSuccess: number;
      totalFailed: number;
      totalSkipped: number;
      lastRunAt?: string;
      lastSuccessAt?: string;
    }[]
  > {
    await this.ensureConnection();
    const docs = await CrawlerRunModel.aggregate<{
      _id: CrawlerName;
      totalRuns: number;
      successRuns: number;
      failedRuns: number;
      cancelledRuns: number;
      totalItems: number;
      totalSuccess: number;
      totalFailed: number;
      totalSkipped: number;
      lastRunAt?: string;
      lastSuccessAt?: string;
    }>([
      {
        $group: {
          _id: '$crawler',
          totalRuns: { $sum: 1 },
          successRuns: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
          failedRuns: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
          cancelledRuns: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
          totalItems: { $sum: '$stats.total' },
          totalSuccess: { $sum: '$stats.success' },
          totalFailed: { $sum: '$stats.failed' },
          totalSkipped: { $sum: '$stats.skipped' },
          lastRunAt: { $max: '$startedAt' },
          lastSuccessAt: {
            $max: { $cond: [{ $eq: ['$status', 'success'] }, '$finishedAt', null] },
          },
        },
      },
    ]);
    return docs;
  },
};

export const CrawlerConfigRepository = {
  async ensureConnection(): Promise<void> {
    await getMongo();
  },

  async get(name: CrawlerName): Promise<CrawlerConfig> {
    await this.ensureConnection();
    const doc = await CrawlerConfigModel.findOne({ name })
      .lean<CrawlerConfigDoc>()
      .exec();
    if (!doc) return DEFAULT_CONFIG;
    const d = doc as unknown as {
      rateLimit: number;
      maxRetries: number;
      timeout: number;
      maxWorkers: number;
      kafkaTopic: string | null;
      userAgent: string;
    };
    return {
      rateLimit: d.rateLimit ?? DEFAULT_CONFIG.rateLimit,
      maxRetries: d.maxRetries ?? DEFAULT_CONFIG.maxRetries,
      timeout: d.timeout ?? DEFAULT_CONFIG.timeout,
      maxWorkers: d.maxWorkers ?? DEFAULT_CONFIG.maxWorkers,
      kafkaTopic: d.kafkaTopic ?? null,
      userAgent: d.userAgent ?? DEFAULT_CONFIG.userAgent,
    };
  },

  async update(name: CrawlerName, body: unknown): Promise<CrawlerConfig> {
    await this.ensureConnection();
    const cfg = CrawlerConfigBodySchema.parse(body);
    await CrawlerConfigModel.updateOne(
      { name },
      {
        $set: {
          name,
          rateLimit: cfg.rateLimit,
          maxRetries: cfg.maxRetries,
          timeout: cfg.timeout,
          maxWorkers: cfg.maxWorkers,
          kafkaTopic: cfg.kafkaTopic,
          userAgent: cfg.userAgent,
        },
      },
      { upsert: true },
    );
    return {
      rateLimit: cfg.rateLimit,
      maxRetries: cfg.maxRetries,
      timeout: cfg.timeout,
      maxWorkers: cfg.maxWorkers,
      kafkaTopic: cfg.kafkaTopic,
      userAgent: cfg.userAgent,
    };
  },
};

export { DEFAULT_CONFIG };