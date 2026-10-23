import { test, expect } from '@playwright/test';
import { z } from 'zod';

test.describe('Live Databricks integration', () => {
  test.skip(process.env.DATABRICKS_E2E !== '1', 'Requires the configured Databricks workspace; never uses fixture data');
  test.setTimeout(90000);

  test('Catalog previews real schema and rows from Databricks', async ({ page }, info) => {
    await page.goto('/catalog');
    await expect(page.getByText('Data source: Databricks · workspace', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /workspace\.bronze/ }).click();
    await page.getByRole('button', { name: 'orders_test', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('columnheader', { name: 'order_id', exact: true })).toBeVisible({ timeout: 60000 });
    await expect(dialog.locator('tbody tr').first()).toBeInViewport();
    await expect.poll(async () => (await dialog.boundingBox())?.height ?? 0).toBeGreaterThan((page.viewportSize()?.height ?? 1000) * 0.9);
    await expect(dialog.getByText(/^Rows: \d/)).toBeVisible({ timeout: 60000 });
    await page.screenshot({ path: info.outputPath('catalog-databricks.png'), fullPage: true });
  });

  for (const layer of ['bronze', 'silver', 'gold']) {
    test(`${layer} displays real rows and history`, async ({ page }, info) => {
      await page.goto(`/${layer}`);
      const response = await page.request.get(`/api/${layer}`);
      expect(response.status()).toBe(200);
      const values = z.object({ data: z.array(z.object({ table: z.string() })).min(1) }).parse(await response.json());
      const table = values.data[0]?.table;
      if (!table) throw new Error('Expected at least one live table');
      await page.getByRole('button').filter({ hasText: table }).first().click({ timeout: 60000 });
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('tab', { name: 'Sample', exact: true }).click();
      await expect(dialog.locator('tbody tr').first()).toBeVisible({ timeout: 60000 });
      await page.screenshot({ path: info.outputPath(`${layer}-sample-databricks.png`), fullPage: true });
      const historyResponse = await page.request.get(`/api/${layer}/${encodeURIComponent(table)}/history`);
      expect(historyResponse.status()).toBe(200);
      const history = z.object({ data: z.array(z.object({ operation: z.string() })).min(1) }).parse(await historyResponse.json());
      await dialog.getByRole('tab', { name: 'History', exact: true }).click();
      await expect(dialog.getByText(history.data[0]?.operation ?? '', { exact: true }).first()).toBeVisible({ timeout: 60000 });
    });
  }

  test('Gold read-only SQL runs against the Databricks warehouse', async ({ page }, info) => {
    await page.goto('/gold');
    await page.getByRole('button', { name: 'Run Query', exact: true }).first().click();
    await page.locator('textarea').fill('SELECT COUNT(*) AS databricks_orders FROM workspace.bronze.orders_test');
    const response = page.waitForResponse((value) => value.url().includes('/queries/ad-hoc') && value.status() === 200);
    await page.getByRole('button', { name: 'Run Query', exact: true }).last().click();
    await response;
    await expect(page.getByRole('columnheader', { name: 'databricks_orders', exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath('databricks-sql.png'), fullPage: true });
  });
});
