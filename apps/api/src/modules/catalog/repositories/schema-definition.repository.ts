import { getMongo } from '@/lib/infra/mongo';
import { SchemaDefinitionModel, type SchemaDefinitionDoc } from './models';

const toPlain = (doc: SchemaDefinitionDoc | null): SchemaDefinitionDoc | null =>
  doc ? (doc as SchemaDefinitionDoc) : null;

export const SchemaDefinitionRepository = {
  async ensureConnection(): Promise<void> {
    await getMongo();
  },

  async list(): Promise<SchemaDefinitionDoc[]> {
    await this.ensureConnection();
    return SchemaDefinitionModel.find().sort({ name: 1 }).lean<SchemaDefinitionDoc[]>().exec();
  },

  async findByName(name: string): Promise<SchemaDefinitionDoc | null> {
    await this.ensureConnection();
    const doc = await SchemaDefinitionModel.findOne({ name }).lean<SchemaDefinitionDoc>().exec();
    return toPlain(doc);
  },

  async upsert(doc: Partial<SchemaDefinitionDoc> & { name: string }): Promise<SchemaDefinitionDoc> {
    await this.ensureConnection();
    const updated = await SchemaDefinitionModel.findOneAndUpdate(
      { name: doc.name },
      { $set: doc },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    )
      .lean<SchemaDefinitionDoc>()
      .exec();
    return updated as SchemaDefinitionDoc;
  },
};