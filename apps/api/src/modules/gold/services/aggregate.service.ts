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

export const GoldAggregateService = {
  async aggregateOne(
    params: TTableParams,
    body: TAggregateBody,
  ): Promise<GoldJob> {
    const parsed = parseDatabaseTable(params.table);
    if (!parsed) throw new Error(`Invalid table identifier: ${params.table}`);
    const sources = body.sourceTables ?? [parsed.name];
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
    const tables = await GoldDuckDBRepository.listTables({});
    const sliced = tables.slice(0, 200);
    const items: GoldJob[] = [];
    for (const table of sliced) {
      const parsed = parseDatabaseTable(table);
      if (!parsed) continue;
      const jobId = GoldJobService.generateJobId();
      const job = await GoldJobRepository.create({
        jobId,
        database: parsed.database,
        table: parsed.name,
        kind: body.kind,
        sourceTables: [parsed.name],
      });
      await GoldQueue.add({
        jobId,
        database: parsed.database,
        table: parsed.name,
        kind: body.kind,
        sourceTables: [parsed.name],
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
    const parsed = parseDatabaseTable(params.table);
    if (!parsed) throw new Error(`Invalid table identifier: ${params.table}`);
    const jobId = GoldJobService.generateJobId();
    const kind: GoldAggregateKind = body.preserveHistory ? 'incremental' : 'refresh';
    const job = await GoldJobRepository.create({
      jobId,
      database: parsed.database,
      table: parsed.name,
      kind,
      sourceTables: [parsed.name],
    });
    await GoldQueue.add({
      jobId,
      database: parsed.database,
      table: parsed.name,
      kind,
      sourceTables: [parsed.name],
      ...(body.partition ? { partition: body.partition } : {}),
      preserveHistory: body.preserveHistory,
      startedAt: job.startedAt,
    });
    logger.info({ jobId, table: params.table, kind }, 'Gold refresh job enqueued');
    return job;
  },
};