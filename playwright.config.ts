import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests for the demo apps and the registry, driven as ordinary
 * websites with no extension and no WebMCP involved.
 *
 * This layer answers "are the demo apps actually working web apps?" — which
 * matters precisely because the whole project's claim is that adapters drive
 * real UIs. The WebMCP pipeline itself is verified separately by the acceptance
 * runners, which observe tools through the DevTools WebMCP domain.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : [['list']],
  use: { baseURL: 'http://localhost:5273', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { command: 'pnpm --filter @liha/demo-crm preview', url: 'http://localhost:5273', reuseExistingServer: true, timeout: 60_000 },
    { command: 'pnpm --filter @liha/demo-shop preview', url: 'http://localhost:5274', reuseExistingServer: true, timeout: 60_000 },
    { command: 'pnpm --filter @liha/demo-project preview', url: 'http://localhost:5275', reuseExistingServer: true, timeout: 60_000 },
    { command: 'pnpm --filter @liha/registry preview', url: 'http://localhost:5280', reuseExistingServer: true, timeout: 60_000 },
  ],
});
