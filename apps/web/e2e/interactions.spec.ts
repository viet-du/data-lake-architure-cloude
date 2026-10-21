import { test, expect } from '@playwright/test';

test('language switching persists through reload and navigation', async ({ page }) => {
  await page.goto('/catalog');
  await page.getByRole('button', { name: 'VI', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Danh mục dữ liệu', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'VI', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/bronze');
  await expect(page.getByRole('heading', { name: 'Lớp Bronze', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bronze Layer', exact: true })).toBeVisible();
});

test('read-only SQL executes only after explicit submit', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/queries/ad-hoc')) requests.push(request.url());
  });
  await page.goto('/gold');
  await page.getByRole('button', { name: 'Run Query', exact: true }).first().click();
  await page.locator('textarea').fill('SELECT 1 AS smoke');
  await expect(page.locator('textarea')).toHaveValue('SELECT 1 AS smoke');
  expect(requests).toEqual([]);
  const result = page.waitForResponse((response) => response.url().includes('/queries/ad-hoc') && response.status() === 200);
  await page.getByRole('button', { name: 'Run Query', exact: true }).last().click();
  await result;
  await expect(page.getByRole('columnheader', { name: 'smoke', exact: true })).toBeVisible();
  expect(requests).toHaveLength(1);
});

test('a transport failure can retry against the recovered live API', async ({ page }) => {
  let unavailable = true;
  let count = 0;
  await page.route('**/api/catalog/databases', async (route) => {
    count += 1;
    if (unavailable) await route.fulfill({ status: 503, json: { error: 'TEST_UNAVAILABLE', message: 'Temporarily unavailable (test)' } });
    else await route.continue();
  });
  await page.goto('/catalog');
  await expect(page.getByText('Temporarily unavailable (test)', { exact: true })).toBeVisible();
  const before = count;
  unavailable = false;
  const response = page.waitForResponse((result) => result.url().includes('/catalog/databases') && result.status() === 200);
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await response;
  await expect(page.getByText('Temporarily unavailable (test)', { exact: true })).toHaveCount(0);
  expect(count).toBeGreaterThan(before);
});

test('401 is rendered as authentication failure, not a network failure', async ({ page }) => {
  await page.route('**/api/catalog/databases', (route) => route.fulfill({ status: 401, json: { error: 'UNAUTHORIZED', message: 'Unauthorized' } }));
  await page.goto('/catalog');
  await expect(page.getByText('Authentication required (401).', { exact: true })).toBeVisible();
  await expect(page.getByText('Network Error', { exact: true })).toHaveCount(0);
});

test('catalog selection requests the chosen database (test-only fixtures)', async ({ page }) => {
  const timestamp = '2026-10-21T00:00:00Z';
  const calls: string[] = [];
  await page.route('**/api/catalog/databases', (route) => route.fulfill({ json: { data: [{ database: 'contract_test', layers: ['bronze', 'gold'], tableCount: 1, description: null, createdAt: timestamp, updatedAt: timestamp }] } }));
  await page.route('**/api/catalog/tables?**', (route) => {
    calls.push(new URL(route.request().url()).searchParams.get('database') ?? '');
    return route.fulfill({ json: { data: [{ tableId: 'gold.contract_test.orders', database: 'contract_test', name: 'orders', layer: 'gold', sizeBytes: 200, rowCount: 3, lastModified: timestamp }] } });
  });
  await page.goto('/catalog');
  await expect(page.getByRole('button', { name: /contract_test/ })).toBeVisible();
  expect(calls).toEqual([]);
  await page.getByRole('button', { name: /contract_test/ }).click();
  await expect(page.getByRole('cell', { name: 'orders', exact: true })).toBeVisible();
  expect(calls).toEqual(['contract_test']);
});

test('Health refresh fetches checks again and dark theme persists', async ({ page }, info) => {
  await page.addInitScript(() => localStorage.setItem('lakehouse.theme', 'dark'));
  await page.goto('/health');
  await page.waitForLoadState('networkidle');
  const response = page.waitForResponse((result) => result.url().endsWith('/api/health/deep') && result.status() === 200);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await response;
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.screenshot({ path: info.outputPath('health-dark.png'), fullPage: true });
});
