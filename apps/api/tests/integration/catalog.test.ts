import { describe, it, expect } from 'vitest';

import {
  TableLayerQuerySchema,
  UpdateTableMetadataSchema,
} from '@/modules/catalog/schemas/table.schema';
import { CreateDatabaseSchema } from '@/modules/catalog/schemas/database.schema';
import { SearchQuerySchema } from '@/modules/catalog/schemas/search.schema';

describe('catalog — Zod schemas', () => {
  it('TableLayerQuerySchema defaults limit=50 offset=0', () => {
    const parsed = TableLayerQuerySchema.parse({});
    expect(parsed.limit).toBe(50);
    expect(parsed.offset).toBe(0);
  });

  it('TableLayerQuerySchema accepts optional layer', () => {
    const parsed = TableLayerQuerySchema.parse({ layer: 'bronze' });
    expect(parsed.layer).toBe('bronze');
  });

  it('CreateDatabaseSchema requires database', () => {
    expect(() => CreateDatabaseSchema.parse({})).toThrow();
    const ok = CreateDatabaseSchema.parse({ database: 'ecommerce' });
    expect(ok.database).toBe('ecommerce');
  });

  it('CreateDatabaseSchema rejects too-long database', () => {
    expect(() => CreateDatabaseSchema.parse({ database: 'a'.repeat(100) })).toThrow();
  });

  it('CreateDatabaseSchema rejects uppercase', () => {
    expect(() => CreateDatabaseSchema.parse({ database: 'Ecommerce' })).toThrow();
  });

  it('UpdateTableMetadataSchema accepts partial fields', () => {
    const ok = UpdateTableMetadataSchema.parse({ description: 'test', tags: ['core'] });
    expect(ok.description).toBe('test');
  });

  it('SearchQuerySchema requires q >= 1 char', () => {
    expect(() => SearchQuerySchema.parse({ q: '' })).toThrow();
    const ok = SearchQuerySchema.parse({ q: 'order', limit: 10 });
    expect(ok.limit).toBe(10);
  });
});