import { test, expect, type APIRequestContext } from '@playwright/test';

/**
 * The "no manual ids" flow, verified in a real browser against the live API.
 *
 * Before the refactor, the EDA profile form asked for a dataset id and the
 * DQ suite form asked for a list of rule UUIDs in a textarea. Neither the
 * dataset id nor a rule UUID is discoverable from the UI, so both forms
 * were unusable: the user had to know the exact `database.table` spelling
 * and the exact rule ids.
 *
 * These tests assert the *behaviour* that replaces that:
 *   - the dataset is picked from the catalog, and the resolved columns are
 *     shown before the scan runs;
 *   - the rules are picked from a list that carries the information the
 *     user actually has (name, dataset, severity);
 *   - no free-text id field is left behind.
 */

interface CatalogTable {
  tableId: string;
  name: string;
  database: string;
  layer: string | null;
}

interface CatalogSchema {
  tableId: string;
  columns: Array<{ name: string; type: string; nullable: boolean }>;
}

interface DqRule {
  ruleId: string;
  name: string;
  table: string;
  column?: string | null;
  severity: string;
}

/**
 * The catalog is read through the dev server's proxy, so the test always
 * sees exactly what the browser sees. The first bronze dataset is used as
 * the fixture, so the test never depends on a hard-coded table name.
 */
async function firstTable(
  request: APIRequestContext,
  layer: string,
): Promise<CatalogTable | null> {
  const response = await request.get(`/api/catalog/tables?layer=${layer}&limit=10`);
  if (!response.ok()) return null;
  const payload = (await response.json()) as { data?: CatalogTable[] };
  const items = payload.data ?? [];
  return items.length > 0 ? items[0] : null;
}

async function schemaOf(
  request: APIRequestContext,
  tableId: string,
): Promise<CatalogSchema | null> {
  const response = await request.get(
    `/api/catalog/tables/${encodeURIComponent(tableId)}/schema`,
  );
  if (!response.ok()) return null;
  const payload = (await response.json()) as { data?: CatalogSchema };
  return payload.data ?? null;
}

async function listRules(request: APIRequestContext): Promise<DqRule[]> {
  const response = await request.get('/api/dq/rules?limit=50');
  if (!response.ok()) return [];
  const payload = (await response.json()) as { data?: { items?: DqRule[] } };
  return payload.data?.items ?? [];
}

test.describe('EDA profile request picks a dataset instead of typing an id', () => {
  test('the dataset and its columns are chosen from the catalog', async ({ page, request }) => {
    const table = await firstTable(request, 'bronze');
    test.skip(table === null, 'no bronze dataset in the catalog');
    const dataset = table as CatalogTable;

    const failures: string[] = [];
    page.on('pageerror', (error) => failures.push(error.message));

    await page.goto('/eda');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Profile dataset' }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // No free-text field for the dataset id is left in the form.
    await expect(dialog.locator('input[name="tableId"]')).toHaveCount(0);

    // The picker lists the datasets of the layer, taken from the catalog.
    await expect(dialog.getByText(dataset.name, { exact: true })).toBeVisible();

    // Picking a dataset resolves its columns and shows them.
    await dialog.getByText(dataset.name, { exact: true }).click();

    const schema = await schemaOf(request, dataset.tableId);
    if (schema !== null && schema.columns.length > 0) {
      await expect(dialog.getByText(schema.columns[0].name, { exact: true })).toBeVisible();
    }

    expect(failures).toEqual([]);
  });

  test('the layer buttons switch the dataset list', async ({ page, request }) => {
    const bronze = await firstTable(request, 'bronze');
    const silver = await firstTable(request, 'silver');
    test.skip(bronze === null, 'no bronze dataset in the catalog');

    await page.goto('/eda');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Profile dataset' }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText((bronze as CatalogTable).name, { exact: true })).toBeVisible();

    await dialog.getByRole('button', { name: 'silver', exact: true }).click();

    if (silver !== null) {
      await expect(dialog.getByText(silver.name, { exact: true })).toBeVisible();
    }
  });
});

test.describe('DQ suite picks rules instead of typing UUIDs', () => {
  test('the rules are listed with their name and dataset', async ({ page, request }) => {
    const rules = await listRules(request);
    test.skip(rules.length === 0, 'no DQ rule in the database');

    const failures: string[] = [];
    page.on('pageerror', (error) => failures.push(error.message));

    await page.goto('/dq');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Run Suite' }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // The textarea that used to ask for rule UUIDs is gone.
    await expect(dialog.locator('textarea')).toHaveCount(0);

    // The first rule is listed with the information the user has.
    const rule = rules[0];
    await expect(dialog.getByText(rule.name, { exact: true })).toBeVisible();

    // Clicking it selects it — the "Run Suite" button becomes enabled,
    // which proves the selection reached the form.
    await dialog.getByText(rule.name, { exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Run Suite' })).toBeEnabled();

    expect(failures).toEqual([]);
  });

  test('the rule list can be searched', async ({ page, request }) => {
    const rules = await listRules(request);
    test.skip(rules.length === 0, 'no DQ rule in the database');

    await page.goto('/dq');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Run Suite' }).first().click();

    const dialog = page.getByRole('dialog');
    const search = dialog.getByRole('searchbox');
    await expect(search).toBeVisible();

    await search.fill('zzz-no-such-rule-zzz');
    await expect(dialog.getByText('No rule matches this filter.')).toBeVisible();
  });
});
