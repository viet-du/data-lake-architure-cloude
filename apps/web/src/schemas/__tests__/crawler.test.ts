import { describe, it, expect } from 'vitest';
import {
  crawlerStatusSchema,
  crawlerJobSchema,
  crawlerJobsResponseSchema,
  runJobPayloadSchema,
} from '../crawler';

describe('crawler schema', () => {
  describe('crawlerStatusSchema', () => {
    it('accepts valid statuses', () => {
      for (const s of ['idle', 'running', 'paused', 'completed', 'failed']) {
        expect(crawlerStatusSchema.parse(s)).toBe(s);
      }
    });

    it('rejects unknown statuses', () => {
      expect(() => crawlerStatusSchema.parse('weird')).toThrow();
    });
  });

  describe('crawlerJobSchema', () => {
    const baseJob = {
      name: 'tiki-electronics',
      source: 'tiki',
      category: 'electronics',
      status: 'running' as const,
      ratePerMinute: 30,
      maxWorkers: 4,
      startedAt: '2026-01-15T10:00:00Z',
      pagesScraped: 100,
      recordsCollected: 5000,
      recordsFailed: 12,
      health: 'healthy' as const,
    };

    it('accepts a minimal valid job', () => {
      expect(crawlerJobSchema.parse(baseJob).name).toBe('tiki-electronics');
    });

    it('rejects negative counts', () => {
      expect(() =>
        crawlerJobSchema.parse({ ...baseJob, pagesScraped: -1 }),
      ).toThrow();
    });

    it('rejects empty name', () => {
      expect(() => crawlerJobSchema.parse({ ...baseJob, name: '' })).toThrow();
    });

    it('rejects unknown status', () => {
      expect(() =>
        crawlerJobSchema.parse({ ...baseJob, status: 'launched' }),
      ).toThrow();
    });
  });

  describe('crawlerJobsResponseSchema', () => {
    it('parses a success envelope with array data', () => {
      const payload = {
        success: true,
        data: [
          {
            name: 'j1',
            source: 'tiki',
            category: 'electronics',
            status: 'running',
            ratePerMinute: 10,
            maxWorkers: 2,
            startedAt: '2026-01-15T10:00:00Z',
            pagesScraped: 1,
            recordsCollected: 1,
            recordsFailed: 0,
            health: 'healthy',
          },
        ],
      };
      const parsed = crawlerJobsResponseSchema.parse(payload);
      expect(parsed.success).toBe(true);
      expect(parsed.data).toHaveLength(1);
    });

    it('rejects when success is false and data is missing', () => {
      expect(() =>
        crawlerJobsResponseSchema.parse({ success: false }),
      ).toThrow();
    });
  });

  describe('runJobPayloadSchema', () => {
    it('accepts an empty object', () => {
      expect(runJobPayloadSchema.parse({})).toEqual({});
    });

    it('accepts pages within range', () => {
      expect(runJobPayloadSchema.parse({ pages: 50 }).pages).toBe(50);
    });

    it('rejects pages out of range', () => {
      expect(() => runJobPayloadSchema.parse({ pages: 0 })).toThrow();
      expect(() => runJobPayloadSchema.parse({ pages: 1001 })).toThrow();
    });

    it('accepts categories list', () => {
      expect(
        runJobPayloadSchema.parse({ categories: ['books', 'games'] }).categories,
      ).toEqual(['books', 'games']);
    });
  });
});
