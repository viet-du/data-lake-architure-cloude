import { DatabaseRepository } from '../repositories';
import { DuckDBRepository } from '../repositories';

export interface CatalogHealth {
  status: 'ok' | 'degraded' | 'down';
  mongodb: { status: 'up' | 'down'; latencyMs: number; error?: string };
  duckdb: { status: 'up' | 'down'; latencyMs: number; error?: string };
  databaseCount: number;
  tableCount: number;
  timestamp: string;
}

export const CatalogHealthController = {
  async check(): Promise<CatalogHealth> {
    const t0 = Date.now();
    let mongodb: CatalogHealth['mongodb'] = { status: 'down', latencyMs: 0, error: 'skipped' };
    try {
      await DatabaseRepository.list();
      mongodb = { status: 'up', latencyMs: Date.now() - t0 };
    } catch (err) {
      mongodb = {
        status: 'down',
        latencyMs: Date.now() - t0,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    const t1 = Date.now();
    let duckdb: CatalogHealth['duckdb'] = { status: 'down', latencyMs: 0, error: 'skipped' };
    try {
      const instance = await DuckDBRepository.ensureConnection();
      void instance;
      duckdb = { status: 'up', latencyMs: Date.now() - t1 };
    } catch (err) {
      duckdb = {
        status: 'down',
        latencyMs: Date.now() - t1,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    const status: CatalogHealth['status'] =
      mongodb.status === 'down' || duckdb.status === 'down'
        ? 'down'
        : 'ok';

    return {
      status,
      mongodb,
      duckdb,
      databaseCount: 0,
      tableCount: 0,
      timestamp: new Date().toISOString(),
    };
  },
};