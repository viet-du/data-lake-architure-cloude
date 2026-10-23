import { test, expect } from '@playwright/test';
import en from '../src/i18n/locales/en.json' with { type: 'json' };
import vi from '../src/i18n/locales/vi.json' with { type: 'json' };

const screens = ['home', 'health', 'catalog', 'crawler', 'bronze', 'silver', 'gold', 'kafka', 'airflow', 'dq', 'schematic'] as const;

for (const language of ['en', 'vi'] as const) {
  for (const screen of screens) {
    test(`${screen} renders ${language} against the live API`, async ({ page }, info) => {
      await page.addInitScript((lang) => localStorage.setItem('lakehouse.language', lang), language);
      const failures: string[] = [];
      const transport: string[] = [];
      const responses: Array<{ path: string; status: number }> = [];
      page.on('pageerror', (error) => failures.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error' && !message.text().includes('Failed to load resource')) failures.push(message.text());
      });
      page.on('requestfailed', (request) => {
        if (!request.failure()?.errorText.includes('ERR_ABORTED')) transport.push(request.url());
      });
      page.on('response', (response) => {
        if (response.url().includes('/api/')) responses.push({ path: new URL(response.url()).pathname, status: response.status() });
      });
      await page.goto(screen === 'home' ? '/' : `/${screen}`);
      await page.waitForLoadState('networkidle');
      const resource = language === 'en' ? en : vi;
      const title = screen === 'home' ? resource.app.name : screen === 'schematic' ? resource.schematic.title : resource.screens[screen].title;
      await expect(page.getByRole('heading', { name: title, exact: true }).last()).toBeVisible();
      if (screen === 'home') {
        const metric = page.locator('[data-stat="tables"]');
        await expect(metric).toHaveText(await metric.getAttribute('data-target') ?? '—');
      }
      const body = await page.locator('body').innerText();
      expect(body).not.toMatch(/\b(?:screens|home|schematic|common|labels)\.[a-z_]+(?:\.[a-z_]+)*/i);
      expect(body).not.toContain('Something went wrong');
      expect(body).not.toContain('NaN');
      expect(body).not.toContain('undefined');
      expect(failures).toEqual([]);
      expect(transport).toEqual([]);
      const unexpected = responses.filter((response) => response.status >= 400 && !(response.path.startsWith('/api/airflow/') && response.status === 503));
      expect(unexpected).toEqual([]);
      if (screen === 'schematic') await expect(page.locator('canvas')).toBeVisible();
      await info.attach('requests', { body: JSON.stringify(responses, null, 2), contentType: 'application/json' });
      await page.screenshot({ path: info.outputPath(`${screen}-${language}.png`), fullPage: true });
    });
  }
}

for (const screen of ['home', 'catalog', 'schematic']) {
  test(`${screen} fits a mobile viewport`, async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(screen === 'home' ? '/' : `/${screen}`);
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`${screen}-mobile.png`), fullPage: true });
  });
}
