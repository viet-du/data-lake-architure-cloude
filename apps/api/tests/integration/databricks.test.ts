import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/config', () => ({ env: {
  LAKEHOUSE_DATA_SOURCE: 'databricks', DATABRICKS_HOST: 'https://fixture.cloud.databricks.com',
  DATABRICKS_TOKEN: 'test-only-secret', DATABRICKS_WAREHOUSE_ID: 'fixture', DATABRICKS_CATALOG: 'workspace',
  DATABRICKS_BRONZE_SCHEMA: 'bronze', DATABRICKS_SILVER_SCHEMA: 'silver', DATABRICKS_GOLD_SCHEMA: 'gold',
} }));
import { identifier, qualifiedName, databricksRequest, readStatement, remoteReadOnly } from '@/lib/infra/databricks/client';

afterEach(() => { vi.unstubAllGlobals(); });
const success = (value = '7', type_name = 'LONG') => ({ statement_id: 'fixture', status: { state: 'SUCCEEDED' }, manifest: { schema: { columns: [{ name: 'value', type_name }] } }, result: { data_array: [[value]] } });

describe('Databricks server connection', () => {
  it('quotes native identifiers and rejects injection or a different configured catalog', () => {
    expect(identifier('orders_test')).toBe('`orders_test`');
    expect(qualifiedName('workspace.bronze.orders_test')).toBe('`workspace`.`bronze`.`orders_test`');
    expect(() => qualifiedName('other.bronze.orders_test')).toThrow();
    expect(() => qualifiedName('workspace.bronze.orders;DROP')).toThrow();
  });
  it.each([401, 403])('preserves HTTP %s without exposing upstream body or token', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('test-only-secret', { status })));
    await expect(databricksRequest('/api/2.1/unity-catalog/catalogs')).rejects.toMatchObject({ status });
    await expect(databricksRequest('/api/2.1/unity-catalog/catalogs')).rejects.not.toThrow('test-only-secret');
  });
  it('prevents credential forwarding through redirects', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({}));
    vi.stubGlobal('fetch', fetch);
    await databricksRequest('/api/2.1/unity-catalog/catalogs');
    expect(fetch).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ redirect: 'error', cache: 'no-store', headers: expect.objectContaining({ Authorization: 'Bearer test-only-secret' }) }));
  });
  it('rejects writes and multiple statements before making a remote request', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await expect(readStatement('DELETE FROM workspace.bronze.orders_test')).rejects.toMatchObject({ status: 400 });
    await expect(readStatement('SELECT 1; DROP TABLE t')).rejects.toMatchObject({ status: 400 });
    expect(fetch).not.toHaveBeenCalled();
    expect(() => remoteReadOnly()).toThrow('read-only');
  });
  it('decodes numeric SQL values and keeps unsafe BIGINT values lossless', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json(success())).mockResolvedValueOnce(Response.json(success('9007199254740993'))));
    expect(await readStatement('SELECT 7')).toEqual([{ value: 7 }]);
    expect(await readStatement('SELECT 9007199254740993')).toEqual([{ value: '9007199254740993' }]);
  });
  it('polls a pending warehouse query instead of canceling at the initial wait boundary', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ statement_id: 'fixture', status: { state: 'PENDING' } })).mockResolvedValueOnce(Response.json(success()));
    vi.stubGlobal('fetch', fetch);
    expect(await readStatement('SELECT 7')).toEqual([{ value: 7 }]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1]?.[0].toString()).toContain('/api/2.0/sql/statements/fixture');
  });
  it('does not mark failed or incomplete statements successful', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ statement_id: 'fixture', status: { state: 'FAILED' } })));
    await expect(readStatement('SELECT 1')).rejects.toMatchObject({ code: 'DATABRICKS_QUERY_FAILED' });
  });
  it('distinguishes SQL permission errors from warehouse unavailability', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ statement_id: 'fixture', status: { state: 'FAILED', sql_state: '42501', error: { error_code: 'BAD_REQUEST', message: 'INSUFFICIENT_PERMISSIONS' } } })));
    await expect(readStatement('SELECT 1')).rejects.toMatchObject({ status: 403, code: 'DATABRICKS_PERMISSION_DENIED' });
  });
  it('rejects truncated results instead of presenting an incomplete preview as complete', async () => {
    const value = success();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ...value, manifest: { ...value.manifest, truncated: true } })));
    await expect(readStatement('SELECT 1')).rejects.toMatchObject({ code: 'DATABRICKS_RESULT_TOO_LARGE' });
  });
});

describe('Unity Catalog pagination', () => {
  it('keeps native identities and fetches subsequent pages without fabricating metrics', async () => {
    const makeTable = (name: string) => ({ name, full_name: `workspace.bronze.${name}`, catalog_name: 'workspace', schema_name: 'bronze', table_type: 'MANAGED', data_source_format: 'DELTA', columns: [] });
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ schemas: [{ name: 'bronze', catalog_name: 'workspace' }] }))
      .mockResolvedValueOnce(Response.json({ tables: [makeTable('one')], next_page_token: 'second' }))
      .mockResolvedValueOnce(Response.json({ tables: [makeTable('two')] }));
    vi.stubGlobal('fetch', fetch);
    const { DatabricksRepository } = await import('@/modules/catalog/repositories/databricks.repository');
    const values = await DatabricksRepository.list({ offset: 0, limit: 100, layer: 'bronze' });
    expect(values.map((table) => table.tableId)).toEqual(['workspace.bronze.one', 'workspace.bronze.two']);
    expect(values.every((table) => table.rowCount === null && table.sizeBytes === null)).toBe(true);
    expect(fetch.mock.calls.some(([url]) => String(url).includes('page_token=second'))).toBe(true);
  });
});
