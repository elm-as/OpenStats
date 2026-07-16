import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config — E2E tests for the OpenStats frontend.
 * Tests live in `e2e/`. Requires the dev server (and backend) to be reachable.
 *
 * Run:
 *   npx playwright install        (first time only)
 *   npm run test:e2e
 *
 * The backend at http://localhost:5000 must be running for full parcours;
 * the smoke test only needs the frontend (started automatically by webServer).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
