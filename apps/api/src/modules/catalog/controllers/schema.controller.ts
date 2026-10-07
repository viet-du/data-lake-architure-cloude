import { SearchService } from '../services/search.service';
import type { SchemaDefinition } from '../types';
import type { TSchemaNameParams } from '../schemas';

export const SchemaController = {
  async list(): Promise<SchemaDefinition[]> {
    return SearchService.listSchemas();
  },

  async get(params: TSchemaNameParams): Promise<SchemaDefinition> {
    return SearchService.getSchema(params.name);
  },
};