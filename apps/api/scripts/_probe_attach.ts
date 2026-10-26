import { DuckDBInstance } from '@duckdb/node-api';

const esc = (v: string) => v.replaceAll("'", "''");
const raw = process.env.S3_ENDPOINT || process.env.MINIO_ENDPOINT || '';
const endpoint = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
const url = new URL(endpoint);
const useSsl = url.protocol === 'https:';
const key = process.env.S3_ACCESS_KEY || process.env.MINIO_ACCESS_KEY || '';
const secret = process.env.S3_SECRET_KEY || process.env.MINIO_SECRET_KEY || '';
const region = process.env.S3_REGION || 'us-east-1';

async function main(): Promise<void> {
  const instance = await DuckDBInstance.create();
  const conn = await instance.connect();
  await conn.run('INSTALL httpfs; LOAD httpfs;');
  await conn.run('INSTALL delta; LOAD delta;');
  await conn.run(
    `CREATE SECRET s (TYPE s3, KEY_ID '${esc(key)}', SECRET '${esc(secret)}', REGION '${esc(region)}', ENDPOINT '${esc(url.host)}', USE_SSL ${useSsl}, URL_STYLE 'path')`,
  );

  // Probe 1: does ATTACH ... (TYPE DELTA) work? That would give real Delta writes.
  const target = 's3://lakehouse/_probe2/bronze/qa/probe';
  try {
    await conn.run(`ATTACH '${target}' AS probe_db (TYPE DELTA)`);
    console.log('ATTACH TYPE DELTA: OK');
    await conn.run('CREATE TABLE probe_db.t1 AS SELECT 1::BIGINT AS id, 9.9::DOUBLE AS amt');
    console.log('CREATE TABLE via attached delta: OK');
    const r = await conn.runAndReadAll(`SELECT COUNT(*)::BIGINT c FROM delta_scan('${target}/t1')`);
    console.log('read back:', JSON.stringify(r.getRowObjects()));
    const h = await conn.runAndReadAll(`SELECT MAX(version)::BIGINT v FROM delta_scan('${target}/t1')`);
    console.log('delta version:', JSON.stringify(h.getRowObjects()));
    await conn.run('DETACH probe_db');
  } catch (e) {
    console.log('ATTACH TYPE DELTA ERR:', (e as Error).message.split('\n').slice(0, 3).join(' / '));
  }

  // Probe 2: does ATTACH on a plain path (not a table dir) behave as a catalog?
  try {
    const r = await conn.runAndReadAll(`SELECT * FROM duckdb_extensions() WHERE extension_name='delta'`);
    console.log('delta ext row:', JSON.stringify(r.getRowObjects()));
  } catch (e) {
    console.log('ext ERR', (e as Error).message.split('\n')[0]);
  }

  instance.closeSync();
  console.log('PROBE-DONE');
}

void main().catch((e: Error) => {
  console.error('FATAL', e.message);
  process.exit(1);
});
