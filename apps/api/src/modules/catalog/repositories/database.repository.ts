import { getMongo } from '@/lib/infra/mongo';
import { DatabaseModel, type DatabaseDoc } from './models';
import type { Layer } from '../types';

type PlainDatabase = {
  database: string;
  description: string | null;
  layers: Layer[];
  tableCount: number;
  createdAt: Date;
  updatedAt: Date;
};

const toPlain = (doc: DatabaseDoc | null): PlainDatabase | null =>
  doc
    ? {
        database: doc.database,
        description: doc.description ?? null,
        layers: doc.layers as Layer[],
        tableCount: doc.tableCount,
        createdAt: doc.createdAt as unknown as Date,
        updatedAt: doc.updatedAt as unknown as Date,
      }
    : null;

export const DatabaseRepository = {
  async ensureConnection(): Promise<void> {
    await getMongo();
  },

  async list(): Promise<PlainDatabase[]> {
    await this.ensureConnection();
    const docs = await DatabaseModel.find().sort({ database: 1 }).lean<DatabaseDoc[]>().exec();
    return docs.map((d) => toPlain(d) as PlainDatabase);
  },

  async findByName(database: string): Promise<PlainDatabase | null> {
    await this.ensureConnection();
    const doc = await DatabaseModel.findOne({ database }).lean<DatabaseDoc>().exec();
    return toPlain(doc);
  },

  async create(input: {
    database: string;
    description?: string;
    layers: Layer[];
  }): Promise<PlainDatabase> {
    await this.ensureConnection();
    const doc = await DatabaseModel.create({
      database: input.database,
      layers: input.layers,
      tableCount: 0,
      ...(input.description !== undefined ? { description: input.description } : {}),
    });
    return toPlain(doc) as PlainDatabase;
  },

  async delete(database: string): Promise<number> {
    await this.ensureConnection();
    const res = await DatabaseModel.deleteOne({ database }).exec();
    return res.deletedCount ?? 0;
  },

  async incrementTableCount(database: string, delta: number): Promise<void> {
    await this.ensureConnection();
    await DatabaseModel.updateOne({ database }, { $inc: { tableCount: delta } }).exec();
  },
};