import { getDuckDB } from '@/lib/infra/duckdb';
import type { ColumnMeta, Layer } from '../types';

export interface DeltaTableInfo {
  s3Path: string;
  columns: ColumnMeta[];
  rowCount: number;
  sizeBytes: number;
  lastModified: string | null;
  deltaHistoryVersion: number;
  partitions: Array<{ column: string; value: string }>;
}

function escapeS3Path(path: string): string {
  return path.replace(/'/g, "''");
}

export const DuckDBRepository = {
  async ensureConnection(): Promise<void> {
    await getDuckDB();
  },

  async listTablesInDatabase(layer: Layer, database: string): Promise<DeltaTableInfo[]> {
    await this.ensureConnection();
    const instance = await getDuckDB();
    const conn = await instance.connect();
    const bucket = 'lakehouse';
    const prefix = `${layer}/${database}/`;
    const safePrefix = escapeS3Path(prefix);
    const res = await conn.runAndReadAll(`
      SELECT file
      FROM glob('s3://${bucket}/${safePrefix}*/_delta_log/00000000000000000000.json')
      ORDER BY file
    `);
    const rows = res.getRowObjects() as Array<{ file: string }>;
    const tables: DeltaTableInfo[] = [];
    for (const row of rows) {
      const match = row.file.match(new RegExp(`/${layer}/${database}/([^/]+)/_delta_log/`));
      if (!match || !match[1]) continue;
      tables.push({
        s3Path: `s3://${bucket}/${layer}/${database}/${match[1]}`,
        columns: [],
        rowCount: 0,
        sizeBytes: 0,
        lastModified: null,
        deltaHistoryVersion: 0,
        partitions: [],
      });
    }
    return tables;
  },

  async getTableInfo(layer: Layer, database: string, name: string): Promise<DeltaTableInfo | null> {
    await this.ensureConnection();
    const instance = await getDuckDB();
    const conn = await instance.connect();
    const bucket = 'lakehouse';
    const s3Path = `s3://${bucket}/${layer}/${database}/${name}`;
    const safeS3 = escapeS3Path(s3Path);

    const colsRes = await conn.runAndReadAll(`DESCRIBE '${safeS3}'`);
    const cols = colsRes.getRowObjects() as Array<{ column_name: string; column_type: string; null: string }>;
    const columns: ColumnMeta[] = cols.map((c) => ({
      name: c.column_name,
      type: c.column_type,
      nullable: c.null === 'YES',
    }));

    let rowCount = 0;
    try {
      const countRes = await conn.runAndReadAll(`SELECT COUNT(*)::BIGINT AS cnt FROM '${safeS3}'`);
      const rows = countRes.getRowObjects() as Array<{ cnt: number | bigint }>;
      if (rows[0]) rowCount = Number(rows[0].cnt);
    } catch {
      rowCount = 0;
    }

    let histVersion = 0;
    try {
      const histRes = await conn.runAndReadAll(
        `SELECT MAX(version)::BIGINT AS v FROM delta_scan('${safeS3}')`,
      );
      const rows = histRes.getRowObjects() as Array<{ v: number | bigint | null }>;
      if (rows[0] && rows[0].v !== null) histVersion = Number(rows[0].v);
    } catch {
      histVersion = 0;
    }

    return {
      s3Path,
      columns,
      rowCount,
      sizeBytes: 0,
      lastModified: null,
      deltaHistoryVersion: histVersion,
      partitions: [],
    };
  },

  async getTableSample(
    layer: Layer,
    database: string,
    name: string,
    limit: number,
  ): Promise<Array<Record<string, unknown>>> {
    await this.ensureConnection();
    const instance = await getDuckDB();
    const conn = await instance.connect();
    const safeS3 = escapeS3Path(`s3://lakehouse/${layer}/${database}/${name}`);
    const res = await conn.runAndReadAll(`SELECT * FROM '${safeS3}' LIMIT ${limit}`);
    return res.getRowObjects() as Array<Record<string, unknown>>;
  },
};