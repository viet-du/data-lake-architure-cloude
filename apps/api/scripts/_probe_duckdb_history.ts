import { DuckDBInstance } from '@duckdb/node-api';

const esc = (v: string) => v.replaceAll("'", "''");
const raw = process.env.S3_ENDPOINT || process.env.MINIO_ENDPOINT || '';
const endpoint = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
const url = new URL(endpoint);
const useSsl = url.protocol === 'https:';
const key = process.env.S3_ACCESS_KEY || process.env.MINIO_ACCESS_KEY || '';
const secret = process.env.S3_SECRET_KEY || process.env.MINIO_SECRET_KEY || '';
const region = process.env.S3_REGION || 'us-east-1';

const jsonSafe = (v: unknown): unknown => {
  if (typeof v === 'bigint') return Number(v);
  if (Array.isArray(v)) return v.map(jsonSafe);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = jsonSafe(val);
    return out;
  }
  return v;
};

async function main(): Promise<void> {
  const instance = await DuckDBInstance.create();
  const conn = await instance.connect();
  await conn.run('INSTALL httpfs; LOAD httpfs;');
  await conn.run('INSTALL delta; LOAD delta;');
  await conn.run(
    `CREATE SECRET s (TYPE s3, KEY_ID '${esc(key)}', SECRET '${esc(secret)}', REGION '${esc(region)}', ENDPOINT '${esc(url.host)}', USE_SSL ${useSsl}, URL_STYLE 'path')`,
  );
  const target = 's3://lakehouse/_probe/bronze/qa/probe';

  // 1. Delta commit log JSON structure via read_json
  const logRows = await conn.runAndReadAll(
    `SELECT file FROM glob('${esc(target)}/_delta_log/*.json') ORDER BY file`,
  );
  const files = (logRows.getRowObjects() as Array<{ file: string }>).map((r) => r.file);
  console.log('DUCK log files:', files.length);

  const commit = await conn.runAndReadAll(`SELECT * FROM read_json('${esc(files[0] ?? '')}')`);
  console.log('DUCK commit columns:', JSON.stringify(commit.columnNames()));
  console.log('DUCK commit row:', JSON.stringify(commit.getRowObjects().map(jsonSafe)));

  // 2. Can we read every commit and extract commitInfo fields?
  const list = files.map((f) => `'${esc(f)}'`).join(',');
  if (list) {
    const hist = await conn.runAndReadAll(
      `SELECT commitInfo.operation AS operation, commitInfo.timestamp AS ts, commitInfo.txnId AS txn FROM read_json([${list}])`,
    );
    console.log('DUCK history rows:', JSON.stringify(hist.getRowObjects().map(jsonSafe)));
  }

  // 3. delta_list_files partitions struct shape
  const lf = await conn.runAndReadAll(
    `SELECT data_file, partitions, cardinality FROM delta_list_files('${esc(target)}')`,
  );
  console.log('DUCK list_files:', JSON.stringify(lf.getRowObjects().map(jsonSafe)));

  conn.closeSync();
  instance.closeSync();
  console.log('DUCK-DONE');
}

void main().catch((e: Error) => {
  console.log('ERR:', e.message.split('\n').slice(0, 5).join(' / '));
  process.exit(1);
});
