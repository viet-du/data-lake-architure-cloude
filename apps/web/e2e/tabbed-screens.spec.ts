import { test, expect } from '@playwright/test';

/**
 * The tab-bar regression, verified in a real browser against the live API.
 *
 * Both screens used to render `<TabsList>` **outside** `<TabsRoot>`. The
 * `TabsTrigger` then threw "Tabs subcomponents must be used inside
 * <Tabs>", the error boundary swallowed the whole screen, and the user saw
 * "Something went wrong" instead of the screen.
 *
 * The existing `screens.spec.ts` already asserts that the body does not
 * contain "Something went wrong", but it never visited `/eda`, so the EDA
 * screen was never covered. This spec closes that gap and pins the tab bar
 * itself.
 */

const tabbedScreens = [
  { path: '/eda', name: 'EDA' },
  { path: '/dq', name: 'Data Quality' },
] as const;

for (const screen of tabbedScreens) {
  test(`${screen.name} renders the tab bar without the error boundary`, async ({ page }, info) => {
    const failures: string[] = [];
    page.on('pageerror', (error) => failures.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && !message.text().includes('Failed to load resource')) {
        failures.push(message.text());
      }
    });

    await page.goto(screen.path);
    await page.waitForLoadState('networkidle');

    const body = await page.locator('body').innerText();

    // The regression itself: the error boundary must not have replaced the
    // screen, and the tabs error must not appear anywhere.
    expect(body).not.toContain('Something went wrong');
    expect(body).not.toContain('Tabs subcomponents must be used inside');
    expect(failures).toEqual([]);

    // The tab bar itself must be rendered, with the `tablist` role the
    // `TabsList` component assigns.
    const tablist = page.getByRole('tablist');
    await expect(tablist).toHaveCount(1);
    await expect(tablist.locator('[role="tab"]').first()).toBeVisible();

    await info.attach('tabs', {
      body: JSON.stringify(await tablist.locator('[role="tab"]').allInnerTexts(), null, 2),
      contentType: 'application/json',
    });
    await page.screenshot({ path: info.outputPath(`${screen.path.slice(1)}.png`), fullPage: true });
  });

  test(`${screen.name} switches tabs without crashing`, async ({ page }) => {
    const failures: string[] = [];
    page.on('pageerror', (error) => failures.push(error.message));

    await page.goto(screen.path);
    await page.waitForLoadState('networkidle');

    const tabs = page.getByRole('tab');
    const count = await tabs.count();
    expect(count).toBeGreaterThan(1);

    for (let index = 0; index < count; index += 1) {
      const tab = tabs.nth(index);
      await tab.click();
      await expect(tab).toHaveAttribute('aria-selected', 'true');
    }

    expect(failures).toEqual([]);
    expect(await page.locator('body').innerText()).not.toContain('Something went wrong');
  });
}
