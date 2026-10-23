import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  workers: 1,
  fullyParallel: false,
  outputDir: '../../test-results/browser',
  reporter: [['list'], ['json', { outputFile: '../../test-results/browser-results.json' }]],
  use: {
    baseURL: process.env.BROWSER_BASE_URL ?? 'http://127.0.0.1:5174',
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: {
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
      args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  webServer: {
    command: 'pnpm dev --host 127.0.0.1 --port 5174',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
