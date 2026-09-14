import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';

/**
 * The whole product, exercised the way a person uses it.
 *
 * These tests are the evidence for the central claim on the marketing pages:
 * the plaintext and the decryption key are never transmitted. We record every
 * request the browser makes and assert the secret appears in none of them.
 */

interface Traffic {
  bodies: string[];
  urls: string[];
}

function recordTraffic(page: Page): Traffic {
  const traffic: Traffic = { bodies: [], urls: [] };
  page.on('request', (request) => {
    traffic.urls.push(request.url());
    const body = request.postData();
    if (body) traffic.bodies.push(body);
  });
  return traffic;
}

function everythingSent(traffic: Traffic): string {
  return [...traffic.bodies, ...traffic.urls].join('\n');
}

async function createNote(
  page: Page,
  message: string,
  configure?: (page: Page) => Promise<void>,
): Promise<string> {
  await page.goto('/');
  await page.getByPlaceholder('Type your private message here...').fill(message);
  if (configure) {
    await page.getByRole('button', { name: 'More options' }).click();
    await configure(page);
  }
  await page.getByRole('button', { name: 'Create ShredNote' }).click();
  await expect(page.getByRole('heading', { name: 'Your ShredNote is ready.' })).toBeVisible();
  return page.locator('#shrednote-link').inputValue();
}

test('a note can be created, read once, and is gone afterwards', async ({ page, context }) => {
  const message = 'staging-db-password: pelican-ridge-84';
  const traffic = recordTraffic(page);

  const link = await createNote(page, message);
  expect(link).toMatch(/\/n\/[A-Za-z0-9_-]{22}#1\.[A-Za-z0-9_-]{43}$/);

  // The sender's browser transmitted neither the message nor the key.
  const sent = everythingSent(traffic);
  const fragment = link.split('#')[1]!;
  expect(sent).not.toContain(message);
  expect(sent).not.toContain(fragment);
  expect(sent).not.toContain(fragment.split('.')[1]);

  // The recipient opens it.
  const recipient = await context.newPage();
  const recipientTraffic = recordTraffic(recipient);
  await recipient.goto(link);

  await expect(recipient.getByRole('heading', { name: /You.{0,3}ve received a ShredNote/ })).toBeVisible();
  await expect(recipient.locator('pre')).toHaveCount(0);

  await recipient.getByRole('button', { name: 'Reveal & Shred' }).click();
  await expect(recipient.locator('pre')).toHaveText(message);
  await expect(recipient.getByText('This message has been shredded.')).toBeVisible();

  // The key was not sent on the reading side either, and it has been removed
  // from the address bar.
  expect(everythingSent(recipientTraffic)).not.toContain(fragment.split('.')[1]);
  expect(recipient.url()).not.toContain('#');

  // Any later visit, in any browser, sees the same thing.
  const second = await context.newPage();
  await second.goto(link);
  await expect(second.getByRole('heading', { name: 'This ShredNote is gone.' })).toBeVisible();
  await expect(second.getByRole('link', { name: 'Create a ShredNote' })).toBeVisible();
});

test('a never-created note id is indistinguishable from a consumed one', async ({ page }) => {
  await page.goto('/n/AAAAAAAAAAAAAAAAAAAAAA#1.' + 'B'.repeat(43));
  await expect(page.getByRole('heading', { name: 'This ShredNote is gone.' })).toBeVisible();
});

test('a link without its fragment reports a broken link and consumes nothing', async ({
  page,
  context,
}) => {
  const message = 'do not lose me';
  const link = await createNote(page, message);
  const [address, fragment] = link.split('#');

  const truncated = await context.newPage();
  await truncated.goto(address!);
  await expect(truncated.getByRole('heading', { name: 'This link is incomplete.' })).toBeVisible();

  // The note survived: the full link still works.
  const proper = await context.newPage();
  await proper.goto(`${address}#${fragment}`);
  await proper.getByRole('button', { name: 'Reveal & Shred' }).click();
  await expect(proper.locator('pre')).toHaveText(message);
});

test('a message containing markup is displayed as text, never executed', async ({
  page,
  context,
}) => {
  const payload = '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>';
  const link = await createNote(page, payload, async (composer) => {
    await composer.getByLabel('Reference label (optional)').fill('<b>label</b>');
  });

  const recipient = await context.newPage();
  await recipient.goto(link);
  await recipient.getByRole('button', { name: 'Reveal & Shred' }).click();

  await expect(recipient.locator('pre')).toHaveText(payload);
  // No element was created from the payload, and no script ran.
  expect(await recipient.locator('pre img').count()).toBe(0);
  expect(await recipient.evaluate(() => (window as { __xss?: number }).__xss)).toBeUndefined();
});

test('a large note round-trips intact', async ({ page, context }) => {
  // Just under the 25,000 character limit.
  const message = Array.from({ length: 400 }, (_, index) => `line ${index}: ${'x'.repeat(40)}`).join(
    '\n',
  );
  expect(message.length).toBeLessThan(25_000);
  const link = await createNote(page, message);

  const recipient = await context.newPage();
  await recipient.goto(link);
  await recipient.getByRole('button', { name: 'Reveal & Shred' }).click();
  await expect(recipient.locator('pre')).toHaveText(message);
});

test('an over-length message is refused before anything is encrypted', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('Type your private message here...').fill('y'.repeat(25_001));

  await expect(page.getByText('1 characters over the limit')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create ShredNote' })).toBeDisabled();
});

test('unicode and emoji survive the round trip', async ({ page, context }) => {
  const message = 'Ünïcödé ✅ 🔐 — naïve café\nsecond line\ttabbed';
  const link = await createNote(page, message);

  const recipient = await context.newPage();
  await recipient.goto(link);
  await recipient.getByRole('button', { name: 'Reveal & Shred' }).click();
  await expect(recipient.locator('pre')).toHaveText(message);
});
