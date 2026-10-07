import { describe, it, expect } from 'vitest';

import {
  CrawlerNameParamSchema,
  CrawlerRunIdParamSchema,
  CrawlerListQuerySchema,
  CrawlerRunsListQuerySchema,
  CrawlerRunRequestBodySchema,
} from '@/modules/crawler/schemas/crawler.schema';

describe('crawler — Zod schemas', () => {
  it('CrawlerNameParamSchema only allows known crawlers', () => {
    expect(() => CrawlerNameParamSchema.parse({ name: 'unknown' })).toThrow();
    const ok = CrawlerNameParamSchema.parse({ name: 'hackernews' });
    expect(ok.name).toBe('hackernews');
  });

  it('CrawlerRunIdParamSchema requires non-empty runId', () => {
    expect(() => CrawlerRunIdParamSchema.parse({ name: 'hackernews', runId: '' })).toThrow();
  });

  it('CrawlerListQuerySchema defaults limit=50', () => {
    const parsed = CrawlerListQuerySchema.parse({});
    expect(parsed.limit).toBe(50);
    expect(parsed.offset).toBe(0);
  });

  it('CrawlerRunsListQuerySchema filters by status', () => {
    const ok = CrawlerRunsListQuerySchema.parse({ status: 'success' });
    expect(ok.status).toBe('success');
    expect(() => CrawlerRunsListQuerySchema.parse({ status: 'unknown' })).toThrow();
  });

  it('CrawlerRunRequestBodySchema defaults maxPages=5 dryRun=false', () => {
    const parsed = CrawlerRunRequestBodySchema.parse({});
    expect(parsed.maxPages).toBe(5);
    expect(parsed.dryRun).toBe(false);
  });
});