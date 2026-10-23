import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.API_VERIFY_URL ?? 'http://127.0.0.1:3001';
const results = [];
async function get(path) {
  const response = await fetch(new URL(`/api/${path}`, base), { signal: AbortSignal.timeout(60000) });
  const body = await response.json();
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status} (${body.error ?? 'unknown'})`);
  return body.data;
}
try {
  const info = await get('info');
  if (info.dataSource !== 'databricks') throw new Error('API is not using Databricks');
  results.push({ check: 'source', source: info.dataSource, catalog: info.catalog, readOnly: info.readOnly });
  const databases = await get('catalog/databases');
  results.push({ check: 'schemas', schemas: databases.map((item) => ({ name: item.database, tables: item.tableCount })) });
  for (const layer of ['bronze', 'silver', 'gold']) {
    const tables = await get(layer);
    results.push({ check: layer, tables: tables.map((item) => item.table) });
    const first = tables[0]?.table;
    if (!first) continue;
    const path = `${layer}/${encodeURIComponent(first)}`;
    const detail = await get(path);
    const rows = await get(`${path}/sample?limit=5`);
    const history = await get(`${path}/history`);
    results.push({ check: `${layer}-detail`, table: first, rowCount: detail.rowCount, sizeBytes: detail.sizeBytes, columns: detail.columns.map((column) => column.name), sampledRows: rows.length, historyEntries: history.length });
  }
  const tables = await get('catalog/tables?database=workspace.raw_elt&limit=100');
  results.push({ check: 'non-medallion-schema', tables: tables.map((item) => item.fullName) });
  if (process.env.FULL_VERIFY === '1') {
    const inventory = await get('catalog/tables?limit=1000');
    for (const item of inventory.filter((table) => table.schemaName !== 'information_schema')) {
      const detail = await get(`catalog/tables/${encodeURIComponent(item.tableId)}`);
      const sample = await get(`catalog/tables/${encodeURIComponent(item.tableId)}/sample?limit=1`);
      results.push({ check: 'business-table', table: item.fullName, rowCount: detail.rowCount, sampledRows: sample.length });
    }
  }
  const health = await get('health/deep');
  results.push({ check: 'databricks-health', status: health.services.find((service) => service.name === 'Databricks')?.status });
} catch (error) {
  results.push({ check: 'failure', message: error instanceof Error ? error.message : 'Verification failed' });
  process.exitCode = 1;
}
await mkdir('test-results', { recursive: true });
const report = { checkedAt: new Date().toISOString(), results };
await writeFile('test-results/databricks-live.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
