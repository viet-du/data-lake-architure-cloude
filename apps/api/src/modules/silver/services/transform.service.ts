import { SilverJobRepository } from '../repositories/silver-job.repository';
import { SilverQueue } from '../queues/silver.queue';
import { SilverJobService } from './job.service';
import { SilverDuckDBRepository } from '../repositories/duckdb.repository';
import { logger } from '@/lib/logger';
import type { SilverJob, SilverTransformKind } from '../types';
import type { TTableParams, TTransformBody, TTransformAllBody, TRefreshBody } from '../schemas';

function parseDatabaseTable(table: string): { database: string; name: string } | null {
  const parts = table.split('.');
  if (parts.length !== 2) return null;
  const [database, name] = parts;
  if (!database || !name) return null;
  return { database, name };
}

export const SilverTransformService = {
  async transformOne(
    params: TTableParams,
    body: TTransformBody,
  ): Promise<SilverJob> {
    const parsed = parseDatabaseTable(params.table);
    if (!parsed) throw new Error(`Invalid table identifier: ${params.table}`);
    const jobId = SilverJobService.generateJobId();
    const job = await SilverJobRepository.create({
      jobId,
      database: parsed.database,
      table: parsed.name,
      kind: body.kind,
      ...(body.sourceTable ? { sourceTable: body.sourceTable } : {}),
    });
    await SilverQueue.add({
      jobId,
      database: parsed.database,
      table: parsed.name,
      kind: body.kind,
      ...(body.sourceTable ? { sourceTable: body.sourceTable } : {}),
      ...(body.partition ? { partition: body.partition } : {}),
      startedAt: job.startedAt,
    });
    logger.info(
      { jobId, table: params.table, kind: body.kind, sourceTable: body.sourceTable },
      'Silver transform job enqueued',
    );
    return job;
  },

  async transformAll(body: TTransformAllBody): Promise<{ total: number; items: SilverJob[] }> {
    const tables = await SilverDuckDBRepository.listTables({});
    const sliced = tables.slice(0, 200);
    const items: SilverJob[] = [];
    for (const table of sliced) {
      const parsed = parseDatabaseTable(table);
      if (!parsed) continue;
      const jobId = SilverJobService.generateJobId();
      const job = await SilverJobRepository.create({
        jobId,
        database: parsed.database,
        table: parsed.name,
        kind: body.kind,
      });
      await SilverQueue.add({
        jobId,
        database: parsed.database,
        table: parsed.name,
        kind: body.kind,
        startedAt: job.startedAt,
      });
      items.push(job);
    }
    logger.info(
      { total: items.length, kind: body.kind, parallel: body.parallel },
      'Silver transform-all enqueued',
    );
    return { total: items.length, items };
  },

  async refresh(
    params: TTableParams,
    body: TRefreshBody,
  ): Promise<SilverJob> {
    const parsed = parseDatabaseTable(params.table);
    if (!parsed) throw new Error(`Invalid table identifier: ${params.table}`);
    const jobId = SilverJobService.generateJobId();
    const kind: SilverTransformKind = body.preserveHistory ? 'incremental' : 'refresh';
    const job = await SilverJobRepository.create({
      jobId,
      database: parsed.database,
      table: parsed.name,
      kind,
    });
    await SilverQueue.add({
      jobId,
      database: parsed.database,
      table: parsed.name,
      kind,
      ...(body.partition ? { partition: body.partition } : {}),
      preserveHistory: body.preserveHistory,
      startedAt: job.startedAt,
    });
    logger.info({ jobId, table: params.table, kind }, 'Silver refresh job enqueued');
    return job;
  },
};