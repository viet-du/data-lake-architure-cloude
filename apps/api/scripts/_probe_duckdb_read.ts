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

  const r = await conn.runAndReadAll(
    `SELECT COUNT(*)::BIGINT c FROM delta_scan('${esc(target)}')`,
  );
  console.log('DUCK count:', JSON.stringify(r.getRowObjects().map(jsonSafe)));

  const rows = await conn.runAndReadAll(
    `SELECT * FROM delta_scan('${esc(target)}') ORDER BY id`,
  );
  console.log('DUCK rows:', JSON.stringify(rows.getRowObjects().map(jsonSafe)));

  const hist = await conn.runAndReadAll(
    `SELECT version, operation, timestamp FROM delta_scan('${esc(target)}') ORDER BY version DESC LIMIT 5`,
  );
  console.log('DUCK history:', JSON.stringify(hist.getRowObjects().map(jsonSafe)));

  const desc = await conn.runAndReadAll(`DESCRIBE '${esc(target)}'`);
  console.log('DUCK describe:', JSON.stringify(desc.getRowObjects().map(jsonSafe)));

  conn.closeSync();
  instance.closeSync();
  console.log('DUCK-DONE');
}

void main().catch((e: Error) => {
  console.log('ERR:', e.message.split('\n').slice(0, 4).join(' / '));
  process.exit(1);
});
