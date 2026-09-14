import { randomBytes, scryptSync } from 'node:crypto';

import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end configuration.
 *
 * The suite runs against a real production build talking to a real PostgreSQL
 * database, because the properties worth testing here - single-use
 * consumption, "the key never leaves the browser" - only exist in that
 * combination.
 */
const PORT = Number(process.env.E2E_PORT ?? 3210);
const BASE_URL = `http://127.0.0.1:${PORT}`;

/** Password used by the admin sign-in test. Test-only, never a real secret. */
export const E2E_ADMIN_PASSWORD = 'e2e-admin-password-123';

function scryptHash(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return ['scrypt', 16384, 8, 1, salt.toString('base64url'), derived.toString('base64url')].join(
    '$',
  );
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'line' : 'list',
  timeout: 60_000,

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    // Some sandboxes ship a Chromium build outside Playwright's cache.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },

  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],

  webServer: {
    command: 'npm run start',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      PORT: String(PORT),
      NODE_ENV: 'production',
      DATABASE_URL:
        process.env.E2E_DATABASE_URL ??
        'postgresql://postgres:postgres@localhost:5432/shrednote_test',
      NEXT_PUBLIC_SITE_URL: BASE_URL,
      SERVER_SECRET: 'e2e-server-secret-value-that-is-long-enough-000000',
      CRON_SECRET: 'e2e-cron-secret',
      ADMIN_PASSWORD_HASH: scryptHash(E2E_ADMIN_PASSWORD),
    },
  },
});
