import { mkdir, writeFile } from 'node:fs/promises';

const baseUrl = process.env.API_VERIFY_URL ?? 'http://127.0.0.1:3001';
const paths = ['health', 'health/deep', 'catalog/databases', 'catalog/tables', 'bronze', 'bronze/jobs', 'bronze/jobs/stats', 'silver', 'silver/jobs', 'silver/jobs/stats', 'gold', 'gold/jobs', 'gold/jobs/stats', 'crawler', 'crawler/stats', 'kafka/topics', 'kafka/consumer-groups', 'kafka/stats', 'airflow/dags', 'airflow/stats', 'dq/rules', 'dq/runs', 'dq/summary'];
const results = [];
for (const path of paths) {
  try {
    const response = await fetch(new URL(`/api/${path}`, baseUrl), { signal: AbortSignal.timeout(25_000) });
    const body = await response.json();
    results.push({ path, status: response.status, body });
    console.log(`${path}: HTTP ${response.status}`);
  } catch (error) {
    results.push({ path, error: error instanceof Error ? error.message : String(error) });
    console.error(`${path}: request failed`);
  }
}
await mkdir('test-results', { recursive: true });
await writeFile('test-results/api-results.json', JSON.stringify({ checkedAt: new Date().toISOString(), baseUrl, results }, null, 2));
if (results.some((result) => result.error || result.status !== 200)) process.exitCode = 1;
