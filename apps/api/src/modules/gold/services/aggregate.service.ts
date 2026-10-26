import { remoteReadOnly } from '@/lib/infra/databricks/client';
import { GOLD_AGGREGATE_SOURCES } from '@/modules/datasets/types';
import { GoldJobRepository } from '../repositories/gold-job.repository';
import { GoldQueue } from '../queues/gold.queue';
import { GoldJobService } from './job.service';
import { GoldDuckDBRepository } from '../repositories/duckdb.repository';
import { logger } from '@/lib/logger';
import type { GoldJob, GoldAggregateKind } from '../types';
import type {
  TTableParams,
  TAggregateBody,
  TAggregateAllBody,
  TRefreshBody,
} from '../schemas';

function parseDatabaseTable(table: string): { database: string; name: string } | null {
  const parts = table.split('.');
  if (parts.length !== 2) return null;
  const [database, name] = parts;
  if (!database || !name) return null;
  return { database, name };
}

/**
 * Resolve the Silver sources a Gold aggregate reads from.
 *
 * The default is the canonical mapping (`daily_revenue` ← `orders`,
 * `fact_orders` ← `orders`, `customers`, `products`). The previous default
 * was the Gold table's own name, which is not a Silver dataset at all, so
 * the aggregation either failed or read the wrong table.
 */
function resolveSourceTables(table: string, requested?: string[]): string[] {
  if (requested && requested.length > 0) return requested;
  const canonical = GOLD_AGGREGATE_SOURCES[table];
  if (canonical && canonical.length > 0) return [...canonical];
  throw new Error(
    `No canonical Silver source is defined for the Gold aggregate "${table}". ` +
      'Specify sourceTables explicitly.',
  );
}

export const GoldAggregateService = {
  async aggregateOne(
    params: TTableParams,
    body: TAggregateBody,
  ): Promise<GoldJob> {
    remoteReadOnly();
    const parsed = parseDatabaseTable(params.table);
    if (!parsed) throw new Error(`Invalid table identifier: ${params.table}`);
    const sources = resolveSourceTables(parsed.name, body.sourceTables);
    const jobId = GoldJobService.generateJobId();
    const job = await GoldJobRepository.create({
      jobId,
      database: parsed.database,
      table: parsed.name,
      kind: body.kind,
      sourceTables: sources,
    });
    await GoldQueue.add({
      jobId,
      database: parsed.database,
      table: parsed.name,
      kind: body.kind,
      sourceTables: sources,
      ...(body.partition ? { partition: body.partition } : {}),
      startedAt: job.startedAt,
    });
    logger.info(
      { jobId, table: params.table, kind: body.kind, sourceTables: sources },
      'Gold aggregate job enqueued',
    );
    return job;
  },

  async aggregateAll(body: TAggregateAllBody): Promise<{ total: number; items: GoldJob[] }> {
    remoteReadOnly();
    const tables = await GoldDuckDBRepository.listTables({});
    const sliced = tables.slice(0, 200);
    const items: GoldJob[] = [];
    for (const table of sliced) {
      const parsed = parseDatabaseTable(table);
      if (!parsed) continue;
      // Only aggregates with a canonical Silver source can be refreshed; a
      // Gold table without one would silently read the wrong dataset.
      let sources: string[];
      try {
        sources = resolveSourceTables(parsed.name);
      } catch {
        continue;
      }
      const jobId = GoldJobService.generateJobId();
      const job = await GoldJobRepository.create({
        jobId,
        database: parsed.database,
        table: parsed.name,
        kind: body.kind,
        sourceTables: sources,
      });
      await GoldQueue.add({
        jobId,
        database: parsed.database,
        table: parsed.name,
        kind: body.kind,
        sourceTables: sources,
        startedAt: job.startedAt,
      });
      items.push(job);
    }
    logger.info(
      { total: items.length, kind: body.kind, parallel: body.parallel },
      'Gold aggregate-all enqueued',
    );
    return { total: items.length, items };
  },

  async refresh(
    params: TTableParams,
    body: TRefreshBody,
  ): Promise<GoldJob> {
    remoteReadOnly();
    const parsed = parseDatabaseTable(params.table);
    if (!parsed) throw new Error(`Invalid table identifier: ${params.table}`);
    const jobId = GoldJobService.generateJobId();
    const kind: GoldAggregateKind = body.preserveHistory ? 'incremental' : 'refresh';
    const sources = resolveSourceTables(parsed.name);
    const job = await GoldJobRepository.create({
      jobId,
      database: parsed.database,
      table: parsed.name,
      kind,
      sourceTables: sources,
    });
    await GoldQueue.add({
      jobId,
      database: parsed.database,
      table: parsed.name,
      kind,
      sourceTables: sources,
      ...(body.partition ? { partition: body.partition } : {}),
      preserveHistory: body.preserveHistory,
      startedAt: job.startedAt,
    });
    logger.info({ jobId, table: params.table, kind }, 'Gold refresh job enqueued');
    return job;
  },
};