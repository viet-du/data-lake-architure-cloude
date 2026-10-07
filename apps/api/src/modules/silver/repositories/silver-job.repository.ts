import { getMongo } from '@/lib/infra/mongo';
import { SilverJobModel, type SilverJobDoc } from './models';
import type { SilverJob, SilverJobStatus, SilverTransformKind, SilverJobStats } from '../types';

type PlainJob = {
  jobId: string;
  database: string;
  table: string;
  kind: SilverTransformKind;
  status: SilverJobStatus;
  sourceTable: string | null | undefined;
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

function toPlain(doc: SilverJobDoc | null): PlainJob | null {
  if (!doc) return null;
  return {
    jobId: doc.jobId,
    database: doc.database,
    table: doc.table,
    kind: doc.kind as SilverTransformKind,
    status: doc.status as SilverJobStatus,
    sourceTable: doc.sourceTable,
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

function plainToJob(plain: PlainJob): SilverJob {
  return {
    jobId: plain.jobId,
    table: `${plain.database}.${plain.table}`,
    database: plain.database,
    kind: plain.kind,
    status: plain.status,
    ...(plain.sourceTable ? { sourceTable: plain.sourceTable } : {}),
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

export const SilverJobRepository = {
  async ensureConnection(): Promise<void> {
    await getMongo();
  },

  async create(input: {
    jobId: string;
    database: string;
    table: string;
    kind: SilverTransformKind;
    sourceTable?: string;
    bullJobId?: string;
  }): Promise<SilverJob> {
    await this.ensureConnection();
    const startedAt = new Date().toISOString();
    const doc = await SilverJobModel.create({
      jobId: input.jobId,
      database: input.database,
      table: input.table,
      kind: input.kind,
      status: 'queued',
      rowCount: 0,
      bytesProcessed: 0,
      attemptsMade: 0,
      startedAt,
      ...(input.sourceTable ? { sourceTable: input.sourceTable } : {}),
      ...(input.bullJobId ? { bullJobId: input.bullJobId } : {}),
    });
    const plain = toPlain(doc.toObject() as unknown as SilverJobDoc);
    return plainToJob(plain as PlainJob);
  },

  async findByJobId(jobId: string): Promise<SilverJob | null> {
    await this.ensureConnection();
    const doc = await SilverJobModel.findOne({ jobId }).lean<SilverJobDoc>().exec();
    const plain = toPlain(doc as unknown as SilverJobDoc);
    if (!plain) return null;
    return plainToJob(plain);
  },

  async update(jobId: string, patch: Partial<SilverJob>): Promise<SilverJob | null> {
    await this.ensureConnection();
    const set: Record<string, unknown> = {};
    if (patch.status !== undefined) set.status = patch.status;
    if (patch.rowCount !== undefined) set.rowCount = patch.rowCount;
    if (patch.bytesProcessed !== undefined) set.bytesProcessed = patch.bytesProcessed;
    if (patch.errorMessage !== undefined) set.errorMessage = patch.errorMessage;
    if (patch.finishedAt !== undefined) set.finishedAt = patch.finishedAt;
    if (patch.durationMs !== undefined) set.durationMs = patch.durationMs;
    if (patch.attemptsMade !== undefined) set.attemptsMade = patch.attemptsMade;
    const doc = await SilverJobModel.findOneAndUpdate({ jobId }, { $set: set }, { new: true })
      .lean<SilverJobDoc>()
      .exec();
    const plain = toPlain(doc as unknown as SilverJobDoc);
    if (!plain) return null;
    return plainToJob(plain);
  },

  async list(filter: {
    status?: SilverJobStatus;
    kind?: SilverTransformKind;
    database?: string;
    table?: string;
    limit: number;
    offset: number;
  }): Promise<SilverJob[]> {
    await this.ensureConnection();
    const q: Record<string, unknown> = {};
    if (filter.status) q.status = filter.status;
    if (filter.kind) q.kind = filter.kind;
    if (filter.database) q.database = filter.database;
    if (filter.table) q.table = filter.table;
    const docs = await SilverJobModel.find(q)
      .sort({ startedAt: -1 })
      .skip(filter.offset)
      .limit(filter.limit)
      .lean<SilverJobDoc[]>()
      .exec();
    return docs
      .map((d) => toPlain(d))
      .filter((p): p is PlainJob => p !== null)
      .map(plainToJob);
  },

  async stats(): Promise<SilverJobStats> {
    await this.ensureConnection();
    const docs = await SilverJobModel.aggregate<{ _id: SilverJobStatus; count: number; rows: number }>([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          rows: { $sum: '$rowCount' },
        },
      },
    ]);
    const map = new Map(docs.map((d) => [d._id, d]));
    const get = (s: SilverJobStatus) => map.get(s) ?? { _id: s, count: 0, rows: 0 };
    return {
      total: docs.reduce((s, d) => s + d.count, 0),
      queued: get('queued').count,
      running: get('running').count,
      completed: get('completed').count,
      failed: get('failed').count,
      cancelled: get('cancelled').count,
      totalRowsTransformed: get('completed').rows,
    };
  },

  async delete(jobId: string): Promise<number> {
    await this.ensureConnection();
    const res = await SilverJobModel.deleteOne({ jobId }).exec();
    return res.deletedCount ?? 0;
  },
};