import { readStatement } from '../src/lib/infra/databricks/client';
import { env } from '../src/config';

async function main(): Promise<void> {
  console.log('DBX provider=' + env.LAKEHOUSE_DATA_SOURCE);
  console.log('DBX host=' + (env.DATABRICKS_HOST ?? '(unset)'));
  const started = Date.now();
  try {
    const rows = await readStatement('SELECT 1 AS ok', 10);
    console.log('DBX-OK ' + JSON.stringify(rows) + ' ms=' + (Date.now() - started));
  } catch (e) {
    const err = e as Error & { code?: string; status?: number };
    console.log(
      'DBX-ERR ' + err.constructor.name +
      ' status=' + (err.status ?? '-') +
      ' code=' + (err.code ?? '-') +
      ' msg=' + err.message +
      ' ms=' + (Date.now() - started),
    );
  }
}

void main();
