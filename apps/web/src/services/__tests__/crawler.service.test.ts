import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/store', () => ({
  useAuthStore: {
    getState: () => ({ token: null }),
  },
}));

import { apiClient } from '../api';
import { crawlerService } from '../crawler';
import { ENDPOINTS } from '../api/endpoints';

describe('crawlerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listJobs hits /api/crawler and unwraps data', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: { success: true, data: [{ name: 'j1', sourceName: 'tiki', description: 'Products', kafkaTopic: null }] },
    });
    const out = await crawlerService.listJobs();
    expect(get).toHaveBeenCalledWith(ENDPOINTS.crawler.jobs);
    expect(out).toEqual([{ name: 'j1', source: 'tiki', description: 'Products', status: 'unknown', health: 'unknown' }]);
  });

  it('getJob hits /api/crawler/:name', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: { success: true, data: { name: 'j1', sourceName: 'tiki', description: 'Products', kafkaTopic: null } },
    });
    const out = await crawlerService.getJob('j1');
    expect(get).toHaveBeenCalledWith(ENDPOINTS.crawler.job('j1'));
    expect(out).toMatchObject({ name: 'j1', source: 'tiki', status: 'unknown' });
  });

  it('runJob POSTs payload to /api/crawler/:name/run', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({
      data: { success: true, data: { runId: 'r1', crawler: 'j1', status: 'success', startedAt: '2026-10-20T00:00:00Z', stats: { total: 2, success: 2, failed: 0 } } },
    });
    const out = await crawlerService.runJob('j1', { pages: 10 });
    expect(post).toHaveBeenCalledWith(ENDPOINTS.crawler.jobRun('j1'), {
      maxPages: 10,
    });
    expect(out).toMatchObject({ runId: 'r1', status: 'success', recordsCollected: 2 });
  });

  it('runJobAsync uses jobRunAsync endpoint', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({
      data: { success: true, data: { runId: 'r2', status: 'queued' } },
    });
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: { runId: 'r2', crawler: 'j1', status: 'queued', startedAt: '2026-10-21T00:00:00Z' } } });
    await crawlerService.runJobAsync('j1', { async: true });
    expect(post).toHaveBeenCalledWith(ENDPOINTS.crawler.jobRunAsync('j1'), {
      maxPages: 1,
    });
  });

  it('stopJob POSTs to /api/crawler/:name/stop', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { success: true } });
    await crawlerService.stopJob('j1');
    expect(post).toHaveBeenCalledWith(ENDPOINTS.crawler.jobStop('j1'), {});
  });

  it('listRuns passes params', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: { success: true, data: { total: 0, items: [] } },
    });
    await crawlerService.listRuns('j1', { limit: 5, status: 'failed' });
    expect(get).toHaveBeenCalledWith(ENDPOINTS.crawler.jobRuns('j1'), {
      params: { limit: 5, status: 'failed' },
    });
  });

  it('getStats hits /api/crawler/stats', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: { success: true, data: [{ crawler: 'tiki', totalItems: 4, totalFailed: 1 }] },
    });
    const out = await crawlerService.getStats();
    expect(get).toHaveBeenCalledWith(ENDPOINTS.crawler.stats);
    expect(out.totalRecords24h).toBe(4);
    expect(out.failedRecords24h).toBe(1);
  });
});
