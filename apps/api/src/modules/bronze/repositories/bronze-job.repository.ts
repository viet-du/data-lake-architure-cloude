import { getMongo } from '@/lib/infra/mongo';
import { BronzeJobModel, type BronzeJobDoc } from './models';
import type { BronzeIngestKind, BronzeJob, BronzeJobStatus, BronzeJobStats } from '../types';

type PlainJob = {
  jobId: string;
  database: string;
  table: string;
  kind: BronzeIngestKind;
  status: BronzeJobStatus;
  source: string | null | undefined;
  topic: string | null | undefined;
  rowCount: number;
  bytesProcessed: number;
  errorMessage: string | null | undefined;
  bullJobId: string | null | undefined;
  startedAt: string;
  finishedAt: string | null | undefined;
  durationMs: number | null | undefined;
  attemptsMade: number;
  createdAt: Date;
  updatedAt: Date;
};

function toPlain(doc: BronzeJobDoc | null): PlainJob | null {
  if (!doc) return null;
  return {
    jobId: doc.jobId,
    database: doc.database,
    table: doc.table,
    kind: doc.kind as BronzeIngestKind,
    status: doc.status as BronzeJobStatus,
    source: doc.source,
    topic: doc.topic,
    rowCount: doc.rowCount,
    bytesProcessed: doc.bytesProcessed,
    errorMessage: doc.errorMessage,
    bullJobId: doc.bullJobId,
    startedAt: doc.startedAt,
    finishedAt: doc.finishedAt,
    durationMs: doc.durationMs,
    attemptsMade: doc.attemptsMade,
    createdAt: doc.createdAt as unknown as Date,
    updatedAt: doc.updatedAt as unknown as Date,
  };
}

function plainToJob(plain: PlainJob): BronzeJob {
  return {
    jobId: plain.jobId,
    table: `${plain.database}.${plain.table}`,
    database: plain.database,
    kind: plain.kind,
    status: plain.status,
    ...(plain.source ? { source: plain.source } : {}),
    ...(plain.topic ? { topic: plain.topic } : {}),
    rowCount: plain.rowCount,
    bytesProcessed: plain.bytesProcessed,
    ...(plain.errorMessage ? { errorMessage: plain.errorMessage } : {}),
    startedAt: plain.startedAt,
    ...(plain.finishedAt ? { finishedAt: plain.finishedAt } : {}),
    ...(plain.durationMs !== null && plain.durationMs !== undefined
      ? { durationMs: plain.durationMs }
      : {}),
    attemptsMade: plain.attemptsMade,
  };
}

export const BronzeJobRepository = {
  async ensureConnection(): Promise<void> {
    await getMongo();
  },

  async create(input: {
    jobId: string;
    database: string;
    table: string;
    kind: BronzeIngestKind;
    source?: string;
    topic?: string;
    bullJobId?: string;
  }): Promise<BronzeJob> {
    await this.ensureConnection();
    const startedAt = new Date().toISOString();
    const doc = await BronzeJobModel.create({
      jobId: input.jobId,
      database: input.database,
      table: input.table,
      kind: input.kind,
      status: 'queued',
      rowCount: 0,
      bytesProcessed: 0,
      attemptsMade: 0,
      startedAt,
      ...(input.source ? { source: input.source } : {}),
      ...(input.topic ? { topic: input.topic } : {}),
      ...(input.bullJobId ? { bullJobId: input.bullJobId } : {}),
    });
    const plain = toPlain(doc.toObject() as unknown as BronzeJobDoc);
    return plainToJob(plain as PlainJob);
  },

  async findByJobId(jobId: string): Promise<BronzeJob | null> {
    await this.ensureConnection();
    const doc = await BronzeJobModel.findOne({ jobId }).lean<BronzeJobDoc>().exec();
    const plain = toPlain(doc as unknown as BronzeJobDoc);
    if (!plain) return null;
    return plainToJob(plain);
  },

  async update(jobId: string, patch: Partial<BronzeJob>): Promise<BronzeJob | null> {
    await this.ensureConnection();
    const set: Record<string, unknown> = {};
    if (patch.status !== undefined) set.status = patch.status;
    if (patch.rowCount !== undefined) set.rowCount = patch.rowCount;
    if (patch.bytesProcessed !== undefined) set.bytesProcessed = patch.bytesProcessed;
    if (patch.errorMessage !== undefined) set.errorMessage = patch.errorMessage;
    if (patch.finishedAt !== undefined) set.finishedAt = patch.finishedAt;
    if (patch.durationMs !== undefined) set.durationMs = patch.durationMs;
    if (patch.attemptsMade !== undefined) set.attemptsMade = patch.attemptsMade;
    const doc = await BronzeJobModel.findOneAndUpdate({ jobId }, { $set: set }, { new: true })
      .lean<BronzeJobDoc>()
      .exec();
    const plain = toPlain(doc as unknown as BronzeJobDoc);
    if (!plain) return null;
    return plainToJob(plain);
  },

  async list(filter: {
    status?: BronzeJobStatus;
    kind?: BronzeIngestKind;
    database?: string;
    table?: string;
    limit: number;
    offset: number;
  }): Promise<BronzeJob[]> {
    await this.ensureConnection();
    const q: Record<string, unknown> = {};
    if (filter.status) q.status = filter.status;
    if (filter.kind) q.kind = filter.kind;
    if (filter.database) q.database = filter.database;
    if (filter.table) q.table = filter.table;
    const docs = await BronzeJobModel.find(q)
      .sort({ startedAt: -1 })
      .skip(filter.offset)
      .limit(filter.limit)
      .lean<BronzeJobDoc[]>()
      .exec();
    return docs
      .map((d) => toPlain(d))
      .filter((p): p is PlainJob => p !== null)
      .map(plainToJob);
  },

  async stats(): Promise<BronzeJobStats> {
    await this.ensureConnection();
    const docs = await BronzeJobModel.aggregate<{ _id: BronzeJobStatus; count: number; rows: number; bytes: number }>([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          rows: { $sum: '$rowCount' },
          bytes: { $sum: '$bytesProcessed' },
        },
      },
    ]);
    const map = new Map(docs.map((d) => [d._id, d]));
    const get = (s: BronzeJobStatus) => map.get(s) ?? { _id: s, count: 0, rows: 0, bytes: 0 };
    return {
      total: docs.reduce((s, d) => s + d.count, 0),
      queued: get('queued').count,
      running: get('running').count,
      completed: get('completed').count,
      failed: get('failed').count,
      cancelled: get('cancelled').count,
      totalRowsIngested: get('completed').rows,
      totalBytesProcessed: get('completed').bytes,
    };
  },

  async delete(jobId: string): Promise<number> {
    await this.ensureConnection();
    const res = await BronzeJobModel.deleteOne({ jobId }).exec();
    return res.deletedCount ?? 0;
  },
};