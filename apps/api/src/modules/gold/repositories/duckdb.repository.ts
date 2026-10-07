import { getDuckDB } from '@/lib/infra/duckdb';
import type { ColumnMeta, PartitionMeta } from '@/modules/catalog/types/table.types';
import type {
  GoldHistoryEntry,
  GoldLineageGraph,
  GoldLineageNode,
  GoldStats,
} from '../types';

const GOLD_BUCKET = 'lakehouse';
const GOLD_LAYER = 'gold';

function escapeS3Path(path: string): string {
  return path.replace(/'/g, "''");
}

function buildS3Path(database: string, table: string): string {
  return `s3://${GOLD_BUCKET}/${GOLD_LAYER}/${database}/${table}`;
}

function inferTableKind(table: string): 'fact' | 'dimension' | 'metric' {
  const lower = table.toLowerCase();
  if (lower.startsWith('fact_') || lower.includes('orders') || lower.includes('transactions')) {
    return 'fact';
  }
  if (
    lower.startsWith('dim_') ||
    lower.includes('customer') ||
    lower.includes('product')
  ) {
    return 'dimension';
  }
  return 'metric';
}

export const GoldDuckDBRepository = {
  async ensureConnection(): Promise<void> {
    await getDuckDB();
  },

  async listTables(filter: {
    database?: string;
    search?: string;
    kind?: 'fact' | 'dimension' | 'metric';
  }): Promise<string[]> {
    await this.ensureConnection();
    const instance = await getDuckDB();
    const conn = await instance.connect();
    const res = await conn.runAndReadAll(`
      SELECT file
      FROM glob('s3://${GOLD_BUCKET}/${GOLD_LAYER}/*/_delta_log/00000000000000000000.json')
      ORDER BY file
    `);
    const rows = res.getRowObjects() as Array<{ file: string }>;
    const tables: string[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      const match = row.file.match(/\/gold\/([^/]+)\/([^/]+)\/_delta_log\//);
      if (!match || !match[1] || !match[2]) continue;
      if (filter.database && match[1] !== filter.database) continue;
      const key = `${match[1]}.${match[2]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (filter.search) {
        const term = filter.search.toLowerCase();
        if (!key.toLowerCase().includes(term)) continue;
      }
      if (filter.kind) {
        const kind = inferTableKind(match[2]);
        if (kind !== filter.kind) continue;
      }
      tables.push(key);
    }
    return tables;
  },

  async describe(database: string, table: string): Promise<ColumnMeta[]> {
    await this.ensureConnection();
    const instance = await getDuckDB();
    const conn = await instance.connect();
    const safeS3 = escapeS3Path(buildS3Path(database, table));
    const res = await conn.runAndReadAll(`DESCRIBE '${safeS3}'`);
    const rows = res.getRowObjects() as Array<{ column_name: string; column_type: string; null: string }>;
    return rows.map((c) => ({
      name: c.column_name,
      type: c.column_type,
      nullable: c.null === 'YES',
    }));
  },

  async count(database: string, table: string): Promise<number> {
    await this.ensureConnection();
    const instance = await getDuckDB();
    const conn = await instance.connect();
    const safeS3 = escapeS3Path(buildS3Path(database, table));
    const res = await conn.runAndReadAll(`SELECT COUNT(*)::BIGINT AS cnt FROM '${safeS3}'`);
    const rows = res.getRowObjects() as Array<{ cnt: number | bigint }>;
    return rows[0] ? Number(rows[0].cnt) : 0;
  },

  async sample(
    database: string,
    table: string,
    limit: number,
  ): Promise<Array<Record<string, unknown>>> {
    await this.ensureConnection();
    const instance = await getDuckDB();
    const conn = await instance.connect();
    const safeS3 = escapeS3Path(buildS3Path(database, table));
    const res = await conn.runAndReadAll(`SELECT * FROM '${safeS3}' LIMIT ${limit}`);
    return res.getRowObjects() as Array<Record<string, unknown>>;
  },

  async history(database: string, table: string): Promise<GoldHistoryEntry[]> {
    await this.ensureConnection();
    const instance = await getDuckDB();
    const conn = await instance.connect();
    const safeS3 = escapeS3Path(buildS3Path(database, table));
    const res = await conn.runAndReadAll(`
      SELECT version, timestamp, operation, user_name, notebook, operation_metrics
      FROM delta_scan('${safeS3}')
      ORDER BY version DESC
      LIMIT 500
    `);
    const rows = res.getRowObjects() as Array<{
      version: number | bigint;
      timestamp: string;
      operation: string;
      user_name: string;
      notebook: string | null;
      operation_metrics: Record<string, number> | null;
    }>;
    return rows.map((r) => ({
      version: Number(r.version),
      timestamp: r.timestamp,
      operation: r.operation,
      user: r.user_name,
      ...(r.notebook ? { notebook: r.notebook } : {}),
      ...(r.operation_metrics ? { operationMetrics: r.operation_metrics } : {}),
    }));
  },

  async fileCount(database: string, table: string): Promise<number> {
    await this.ensureConnection();
    const instance = await getDuckDB();
    const conn = await instance.connect();
    const safeS3 = escapeS3Path(buildS3Path(database, table));
    const res = await conn.runAndReadAll(`
      SELECT COUNT(*)::BIGINT AS cnt
      FROM delta_scan('${safeS3}')
    `);
    const rows = res.getRowObjects() as Array<{ cnt: number | bigint }>;
    return rows[0] ? Number(rows[0].cnt) : 0;
  },

  async sizeBytes(database: string, table: string): Promise<number> {
    await this.ensureConnection();
    const instance = await getDuckDB();
    const conn = await instance.connect();
    const safeS3 = escapeS3Path(buildS3Path(database, table));
    const res = await conn.runAndReadAll(`
      SELECT COALESCE(SUM(file_size_bytes), 0)::BIGINT AS bytes
      FROM delta_scan('${safeS3}')
    `);
    const rows = res.getRowObjects() as Array<{ bytes: number | bigint }>;
    return rows[0] ? Number(rows[0].bytes) : 0;
  },

  async lastRefreshAt(database: string, table: string): Promise<string> {
    const hist = await this.history(database, table);
    if (hist.length === 0) return new Date(0).toISOString();
    return hist[0]?.timestamp ?? new Date().toISOString();
  },

  async stats(database: string, table: string): Promise<GoldStats> {
    const [rowCount, fileCount, size, cols, hist] = await Promise.all([
      this.count(database, table),
      this.fileCount(database, table),
      this.sizeBytes(database, table),
      this.describe(database, table),
      this.history(database, table),
    ]);
    const lastRefresh = hist[0]?.timestamp ?? new Date().toISOString();
    return {
      table: `${database}.${table}`,
      rowCount,
      fileCount,
      sizeBytes: size,
      columnCount: cols.length,
      partitionCount: 0,
      lastModified: new Date().toISOString(),
      lastRefreshAt: lastRefresh,
      deltaHistoryVersion: hist[0]?.version ?? 0,
    };
  },

  async partitionsDetail(database: string, table: string): Promise<PartitionMeta[]> {
    await this.ensureConnection();
    const instance = await getDuckDB();
    const conn = await instance.connect();
    const safeS3 = escapeS3Path(buildS3Path(database, table));
    try {
      const res = await conn.runAndReadAll(`
        SELECT DISTINCT partition FROM delta_scan('${safeS3}') WHERE partition IS NOT NULL
        LIMIT 100
      `);
      const rows = res.getRowObjects() as Array<{ partition: string }>;
      return rows.map((r) => ({ column: 'partition', value: r.partition }));
    } catch {
      return [];
    }
  },

  async runAggregate(
    database: string,
    table: string,
    sourceTables: string[],
    partition?: string,
  ): Promise<{ rowCount: number; bytesProcessed: number }> {
    await this.ensureConnection();
    const instance = await getDuckDB();
    const conn = await instance.connect();
    const goldPath = escapeS3Path(buildS3Path(database, table));
    if (sourceTables.length === 0) {
      sourceTables = [table];
    }
    const sources = sourceTables
      .map((t) => escapeS3Path(`s3://${GOLD_BUCKET}/silver/${database}/${t}`))
      .join(' UNION ALL SELECT * FROM ');
    const wherePartition = partition ? `WHERE partition = '${partition}'` : '';
    const countRes = await conn.runAndReadAll(`
      SELECT COUNT(*)::BIGINT AS cnt
      FROM (SELECT * FROM ${sources}) src ${wherePartition}
    `);
    const countRows = countRes.getRowObjects() as Array<{ cnt: number | bigint }>;
    const rowCount = countRows[0] ? Number(countRows[0].cnt) : 0;
    await conn.run(`
      CREATE OR REPLACE TABLE '${goldPath}' AS
      SELECT * FROM (SELECT * FROM ${sources}) src ${wherePartition}
    `);
    return { rowCount, bytesProcessed: 0 };
  },

  async refresh(
    database: string,
    table: string,
    sourceTables: string[],
    partition?: string,
  ): Promise<{ rowCount: number; bytesProcessed: number }> {
    await this.ensureConnection();
    const instance = await getDuckDB();
    const conn = await instance.connect();
    const goldPath = escapeS3Path(buildS3Path(database, table));
    await conn.run(`DROP TABLE IF EXISTS '${goldPath}'`);
    return this.runAggregate(database, table, sourceTables, partition);
  },

  async lineage(database: string, table: string): Promise<GoldLineageGraph> {
    const allGold = await this.listTables({}).catch(() => [] as string[]);
    const allSilver = await this
      .listTables({})
      .catch(() => [] as string[]);
    const tableKey = `${database}.${table}`;
    const upstream: GoldLineageNode[] = [];
    const downstream: GoldLineageNode[] = [];
    const candidates = [...allGold, ...allSilver].filter((t) => t !== tableKey);
    for (const candidate of candidates) {
      const isUpstream = candidate.startsWith(`${database}.`);
      if (isUpstream) {
        upstream.push({
          table: candidate,
          layer: candidate.includes('silver') ? 'silver' : 'gold',
          direction: 'upstream',
        });
      }
      const isDownstream = candidate.includes(table) && candidate !== tableKey;
      if (isDownstream) {
        downstream.push({
          table: candidate,
          layer: 'gold',
          direction: 'downstream',
        });
      }
    }
    return { table: tableKey, upstream, downstream };
  },
};

export { inferTableKind };