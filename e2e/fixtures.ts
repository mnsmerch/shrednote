import { test as base } from '@playwright/test';

/**
 * Gives every test its own rate-limit bucket.
 *
 * All tests otherwise arrive from 127.0.0.1 and share a bucket, so a full run
 * trips the create limit and starts failing for reasons unrelated to what is
 * being tested. Setting a distinct forwarded IP per test isolates them; the
 * limiter itself is tested directly in tests/integration/operations.test.ts.
 */
let testIndex = 0;

export const test = base.extend({
  // The second argument is Playwright's fixture callback. It is named
  // `provide` rather than the conventional `use` so that ESLint's
  // rules-of-hooks check does not mistake it for React's `use` hook.
  context: async ({ context }, provide) => {
    testIndex += 1;
    await context.setExtraHTTPHeaders({
      'x-forwarded-for': `10.${Math.floor(testIndex / 250) % 250}.${testIndex % 250}.1`,
    });
    await provide(context);
  },
});

export { expect } from '@playwright/test';
