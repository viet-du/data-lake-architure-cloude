import { getMongo } from '@/lib/infra/mongo';
import { TableModel } from './models';
import type { Layer } from '../types';

export interface TableInput {
  tableId: string;
  layer: Layer;
  database: string;
  name: string;
  fullName: string;
  s3Path: string;
  description?: string;
  owner?: string;
  tags: string[];
  partitions: Array<{ column: string; value: string }>;
  columns: Array<{ name: string; type: string; nullable: boolean; description?: string }>;
  columnCount: number;
  rowCount: number;
  sizeBytes: number;
  lastModified: string;
  deltaHistoryVersion: number;
  syncedAt: string;
  lineage: { upstreamTableIds: string[]; downstreamTableIds: string[] };
}

export const TableRepository = {
  async ensureConnection(): Promise<void> {
    await getMongo();
  },

  async list(filter: {
    layer?: Layer;
    database?: string;
    search?: string;
    limit: number;
    offset: number;
  }): Promise<Array<Record<string, unknown>>> {
    await this.ensureConnection();
    const q: Record<string, unknown> = {};
    if (filter.layer) q.layer = filter.layer;
    if (filter.database) q.database = filter.database;
    if (filter.search) {
      q.$or = [
        { name: { $regex: filter.search, $options: 'i' } },
        { fullName: { $regex: filter.search, $options: 'i' } },
        { description: { $regex: filter.search, $options: 'i' } },
        { owner: { $regex: filter.search, $options: 'i' } },
      ];
    }
    return TableModel.find(q)
      .sort({ layer: 1, database: 1, name: 1 })
      .skip(filter.offset)
      .limit(filter.limit)
      .lean<Array<Record<string, unknown>>>()
      .exec();
  },

  async findById(tableId: string): Promise<Record<string, unknown> | null> {
    await this.ensureConnection();
    const doc = await TableModel.findOne({ tableId }).lean<Record<string, unknown>>().exec();
    return doc ?? null;
  },

  async upsert(doc: TableInput): Promise<Record<string, unknown>> {
    await this.ensureConnection();
    const updated = await TableModel.findOneAndUpdate(
      { tableId: doc.tableId },
      { $set: doc },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    )
      .lean<Record<string, unknown>>()
      .exec();
    return (updated as Record<string, unknown>) ?? {};
  },

  async updateMetadata(
    tableId: string,
    patch: { description?: string; owner?: string; tags?: string[] },
  ): Promise<Record<string, unknown> | null> {
    await this.ensureConnection();
    const set: Record<string, unknown> = {};
    if (patch.description !== undefined) set.description = patch.description;
    if (patch.owner !== undefined) set.owner = patch.owner;
    if (patch.tags !== undefined) set.tags = patch.tags;
    const updated = await TableModel.findOneAndUpdate({ tableId }, { $set: set }, { new: true })
      .lean<Record<string, unknown>>()
      .exec();
    return updated ?? null;
  },

  async delete(tableId: string): Promise<number> {
    await this.ensureConnection();
    const res = await TableModel.deleteOne({ tableId }).exec();
    return res.deletedCount ?? 0;
  },

  async listByDatabase(database: string): Promise<Array<Record<string, unknown>>> {
    await this.ensureConnection();
    return TableModel.find({ database })
      .sort({ layer: 1, name: 1 })
      .lean<Array<Record<string, unknown>>>()
      .exec();
  },

  async search(input: {
    q: string;
    layer?: Layer;
    database?: string;
    tag?: string;
    limit: number;
  }): Promise<Array<Record<string, unknown>>> {
    await this.ensureConnection();
    const q: Record<string, unknown> = {
      $or: [
        { name: { $regex: input.q, $options: 'i' } },
        { fullName: { $regex: input.q, $options: 'i' } },
        { description: { $regex: input.q, $options: 'i' } },
        { owner: { $regex: input.q, $options: 'i' } },
        { tags: { $in: [new RegExp(input.q, 'i')] } },
      ],
    };
    if (input.layer) q.layer = input.layer;
    if (input.database) q.database = input.database;
    if (input.tag) q.tags = input.tag;
    return TableModel.find(q).limit(input.limit).lean<Array<Record<string, unknown>>>().exec();
  },

  async updateLineage(
    tableId: string,
    lineage: { upstreamTableIds: string[]; downstreamTableIds: string[] },
  ): Promise<void> {
    await this.ensureConnection();
    await TableModel.updateOne({ tableId }, { $set: { lineage } }).exec();
  },
};