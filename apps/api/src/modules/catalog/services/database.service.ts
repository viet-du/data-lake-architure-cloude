import { ConflictError, NotFoundError } from '@/errors';
import { DatabaseRepository } from '../repositories';
import type { DatabaseMeta } from '../types';
import type { TCreateDatabase } from '../schemas';

function toMeta(input: {
  database: string;
  description: string | null;
  layers: ('bronze' | 'silver' | 'gold')[];
  tableCount: number;
  createdAt: Date;
  updatedAt: Date;
}): DatabaseMeta {
  return {
    database: input.database,
    description: input.description,
    layers: input.layers,
    tableCount: input.tableCount,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

export const DatabaseService = {
  async list(): Promise<DatabaseMeta[]> {
    const docs = await DatabaseRepository.list();
    return docs.map((d) => toMeta(d));
  },

  async getOrFail(database: string): Promise<DatabaseMeta> {
    const doc = await DatabaseRepository.findByName(database);
    if (!doc) throw new NotFoundError('Database', database);
    return toMeta(doc);
  },

  async create(input: TCreateDatabase): Promise<DatabaseMeta> {
    const exists = await DatabaseRepository.findByName(input.database);
    if (exists) throw new ConflictError(`Database '${input.database}' already exists`);
    const doc = await DatabaseRepository.create({
      database: input.database,
      layers: input.layers,
      ...(input.description !== undefined ? { description: input.description } : {}),
    });
    return toMeta(doc);
  },

  async delete(database: string): Promise<void> {
    const doc = await DatabaseRepository.findByName(database);
    if (!doc) throw new NotFoundError('Database', database);
    await DatabaseRepository.delete(database);
  },
};