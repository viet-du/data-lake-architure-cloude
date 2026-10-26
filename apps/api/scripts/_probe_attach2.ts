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

  const target = 's3://lakehouse/_probe3/bronze/qa/probe';
  try {
    await conn.run(`ATTACH '${target}' AS probe_db (TYPE DELTA)`);
    console.log('STEP1 attach ok');
    await conn.run('CREATE TABLE probe_db.t1 (id BIGINT, amt DOUBLE)');
    console.log('STEP2 create table (explicit schema) ok');
    await conn.run(
      "INSERT INTO probe_db.t1 VALUES (1, 9.9), (2, 10.1), (3, NULL)",
    );
    console.log('STEP3 insert ok');
    const r = await conn.runAndReadAll(
      `SELECT COUNT(*)::BIGINT c, SUM(amt)::DOUBLE s FROM delta_scan('${target}/t1')`,
    );
    console.log('STEP4 readback via delta_scan:', JSON.stringify(r.getRowObjects()));
    const h = await conn.runAndReadAll(
      `SELECT * FROM delta_scan('${target}/t1')`,
    );
    console.log('STEP5 rows:', JSON.stringify(h.getRowObjects()));
    await conn.run('DETACH probe_db');
    console.log('STEP6 detach ok');
  } catch (e) {
    console.log('ERR:', (e as Error).message.split('\n').slice(0, 4).join(' / '));
  }

  instance.closeSync();
  console.log('PROBE2-DONE');
}

void main().catch((e: Error) => {
  console.error('FATAL', e.message);
  process.exit(1);
});
