import { getDuckDB } from '@/lib/infra/duckdb';
import type { ColumnMeta, PartitionMeta } from '@/modules/catalog/types/table.types';
import type {
  SilverHistoryEntry,
  SilverPartition,
  SilverStats,
  TimeTravelData,
  DiffResult,
} from '../types';

const SILVER_BUCKET = 'lakehouse';
const SILVER_LAYER = 'silver';

function escapeS3Path(path: string): string {
  return path.replace(/'/g, "''");
}

function buildS3Path(database: string, table: string): string {
  return `s3://${SILVER_BUCKET}/${SILVER_LAYER}/${database}/${table}`;
}

export const SilverDuckDBRepository = {
  async ensureConnection(): Promise<void> {
    await getDuckDB();
  },

  async listTables(filter: { database?: string; search?: string }): Promise<string[]> {
    await this.ensureConnection();
    const instance = await getDuckDB();
    const conn = await instance.connect();
    const res = await conn.runAndReadAll(`
      SELECT file
      FROM glob('s3://${SILVER_BUCKET}/${SILVER_LAYER}/*/_delta_log/00000000000000000000.json')
      ORDER BY file
    `);
    const rows = res.getRowObjects() as Array<{ file: string }>;
    const tables: string[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      const match = row.file.match(/\/silver\/([^/]+)\/([^/]+)\/_delta_log\//);
      if (!match || !match[1] || !match[2]) continue;
      if (filter.database && match[1] !== filter.database) continue;
      const key = `${match[1]}.${match[2]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (filter.search) {
        const term = filter.search.toLowerCase();
        if (!key.toLowerCase().includes(term)) continue;
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

  async history(database: string, table: string): Promise<SilverHistoryEntry[]> {
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

  async partitions(database: string, table: string): Promise<SilverPartition[]> {
    await this.ensureConnection();
    const instance = await getDuckDB();
    const conn = await instance.connect();
    const safeS3 = escapeS3Path(buildS3Path(database, table));
    const res = await conn.runAndReadAll(`
      SELECT partition, COUNT(*)::BIGINT AS row_count, COALESCE(SUM(file_size_bytes), 0)::BIGINT AS size_bytes
      FROM delta_scan('${safeS3}')
      GROUP BY partition
      ORDER BY partition DESC
    `);
    const rows = res.getRowObjects() as Array<{
      partition: string;
      row_count: number | bigint;
      size_bytes: number | bigint;
    }>;
    return rows.map((r) => ({
      partition: r.partition,
      rowCount: Number(r.row_count),
      sizeBytes: Number(r.size_bytes),
      lastModified: new Date().toISOString(),
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

  async stats(database: string, table: string): Promise<SilverStats> {
    const [rowCount, fileCount, size, cols, hist, partitions] = await Promise.all([
      this.count(database, table),
      this.fileCount(database, table),
      this.sizeBytes(database, table),
      this.describe(database, table),
      this.history(database, table),
      this.partitions(database, table),
    ]);
    return {
      table: `${database}.${table}`,
      rowCount,
      fileCount,
      sizeBytes: size,
      columnCount: cols.length,
      partitionCount: partitions.length,
      lastModified: new Date().toISOString(),
      deltaHistoryVersion: hist[0]?.version ?? 0,
    };
  },

  async partitionsDetail(database: string, table: string): Promise<PartitionMeta[]> {
    const parts = await this.partitions(database, table);
    return parts.map((p) => ({ column: 'partition', value: p.partition }));
  },

  async timeTravel(
    database: string,
    table: string,
    version: number,
    limit: number,
  ): Promise<TimeTravelData> {
    await this.ensureConnection();
    const instance = await getDuckDB();
    const conn = await instance.connect();
    const safeS3 = escapeS3Path(buildS3Path(database, table));
    const histRes = await conn.runAndReadAll(`
      SELECT MAX(version)::BIGINT AS v, MAX(timestamp) AS ts
      FROM delta_scan('${safeS3}')
      WHERE version <= ${version}
    `);
    const histRows = histRes.getRowObjects() as Array<{ v: number | bigint | null; ts: string | null }>;
    const resolvedVersion = histRows[0]?.v !== null && histRows[0]?.v !== undefined ? Number(histRows[0].v) : version;
    const ts = histRows[0]?.ts ?? new Date().toISOString();
    const sampleRes = await conn.runAndReadAll(`
      SELECT * FROM '${safeS3}' VERSION AS OF ${resolvedVersion} LIMIT ${limit}
    `);
    const sampleRows = sampleRes.getRowObjects() as Array<Record<string, unknown>>;
    const countRes = await conn.runAndReadAll(`
      SELECT COUNT(*)::BIGINT AS cnt FROM '${safeS3}' VERSION AS OF ${resolvedVersion}
    `);
    const countRows = countRes.getRowObjects() as Array<{ cnt: number | bigint }>;
    return {
      table: `${database}.${table}`,
      version: resolvedVersion,
      timestamp: ts,
      rowCount: countRows[0] ? Number(countRows[0].cnt) : 0,
      sample: sampleRows,
    };
  },

  async diff(
    database: string,
    table: string,
    v1: number,
    v2: number,
  ): Promise<DiffResult> {
    await this.ensureConnection();
    const instance = await getDuckDB();
    const conn = await instance.connect();
    const safeS3 = escapeS3Path(buildS3Path(database, table));
    const addedRes = await conn.runAndReadAll(`
      SELECT COUNT(*)::BIGINT AS cnt
      FROM '${safeS3}' VERSION AS OF ${v2}
      EXCEPT
      SELECT * FROM '${safeS3}' VERSION AS OF ${v1}
    `);
    const addedRows = addedRes.getRowObjects() as Array<{ cnt: number | bigint }>;
    const removedRes = await conn.runAndReadAll(`
      SELECT COUNT(*)::BIGINT AS cnt
      FROM '${safeS3}' VERSION AS OF ${v1}
      EXCEPT
      SELECT * FROM '${safeS3}' VERSION AS OF ${v2}
    `);
    const removedRows = removedRes.getRowObjects() as Array<{ cnt: number | bigint }>;
    return {
      table: `${database}.${table}`,
      v1,
      v2,
      addedRows: addedRows[0] ? Number(addedRows[0].cnt) : 0,
      removedRows: removedRows[0] ? Number(removedRows[0].cnt) : 0,
      changedRows: 0,
      changes: [],
    };
  },

  async runTransform(
    database: string,
    table: string,
    sourceTable?: string,
    partition?: string,
  ): Promise<{ rowCount: number; bytesProcessed: number }> {
    await this.ensureConnection();
    const instance = await getDuckDB();
    const conn = await instance.connect();
    const silverPath = escapeS3Path(buildS3Path(database, table));
    const sourcePath = escapeS3Path(`s3://${SILVER_BUCKET}/bronze/${database}/${sourceTable ?? table}`);
    const wherePartition = partition ? `WHERE partition = '${partition}'` : '';
    const countRes = await conn.runAndReadAll(`
      SELECT COUNT(*)::BIGINT AS cnt FROM '${sourcePath}' ${wherePartition}
    `);
    const countRows = countRes.getRowObjects() as Array<{ cnt: number | bigint }>;
    const rowCount = countRows[0] ? Number(countRows[0].cnt) : 0;
    await conn.run(`
      CREATE OR REPLACE TABLE '${silverPath}' AS
      SELECT * FROM '${sourcePath}' ${wherePartition}
    `);
    return { rowCount, bytesProcessed: 0 };
  },

  async refresh(
    database: string,
    table: string,
    sourceTable?: string,
    partition?: string,
  ): Promise<{ rowCount: number; bytesProcessed: number }> {
    await this.ensureConnection();
    const instance = await getDuckDB();
    const conn = await instance.connect();
    const silverPath = escapeS3Path(buildS3Path(database, table));
    await conn.run(`DROP TABLE IF EXISTS '${silverPath}'`);
    return this.runTransform(database, table, sourceTable, partition);
  },
};