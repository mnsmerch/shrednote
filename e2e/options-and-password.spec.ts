import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';

async function openComposerOptions(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'More options' }).click();
}

async function submitAndGetLink(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Create ShredNote' }).click();
  await expect(page.getByRole('heading', { name: 'Your ShredNote is ready.' })).toBeVisible();
  return page.locator('#shrednote-link').inputValue();
}

test('a password is required to open the note, and a wrong one does not destroy it', async ({
  page,
  context,
}) => {
  const message = 'root:hunter2';
  const password = 'shared-over-the-phone';

  await openComposerOptions(page);
  await page.getByPlaceholder('Type your private message here...').fill(message);
  await page.getByLabel('Password (optional)').fill(password);
  const link = await submitAndGetLink(page);
  await expect(page.getByText('You added a password.')).toBeVisible();

  const recipient = await context.newPage();
  await recipient.goto(link);
  await expect(recipient.getByText('This note is password protected')).toBeVisible();

  // Wrong password: rejected, with a warning, and the note survives.
  await recipient.getByLabel('This note is password protected').fill('wrong-password');
  await recipient.getByRole('button', { name: 'Unlock & Shred' }).click();
  await expect(recipient.getByText('That password is not correct.')).toBeVisible();
  await expect(recipient.getByText('9 attempts left')).toBeVisible();

  // Correct password: opens.
  await recipient.getByLabel('This note is password protected').fill(password);
  await recipient.getByRole('button', { name: 'Unlock & Shred' }).click();
  await expect(recipient.locator('pre')).toHaveText(message);

  // And it is now gone for everyone.
  const second = await context.newPage();
  await second.goto(link);
  await expect(second.getByRole('heading', { name: 'This ShredNote is gone.' })).toBeVisible();
});

test('the password is never transmitted, only a derived proof', async ({ page, context }) => {
  const password = 'correct-horse-battery-staple';

  await openComposerOptions(page);
  await page.getByPlaceholder('Type your private message here...').fill('secret');
  await page.getByLabel('Password (optional)').fill(password);
  const link = await submitAndGetLink(page);

  const recipient = await context.newPage();
  const sent: string[] = [];
  recipient.on('request', (request) => {
    sent.push(request.url());
    const body = request.postData();
    if (body) sent.push(body);
  });

  await recipient.goto(link);
  await recipient.getByLabel('This note is password protected').fill(password);
  await recipient.getByRole('button', { name: 'Unlock & Shred' }).click();
  await expect(recipient.locator('pre')).toHaveText('secret');

  expect(sent.join('\n')).not.toContain(password);
});

test('a password shorter than the minimum blocks submission', async ({ page }) => {
  await openComposerOptions(page);
  await page.getByPlaceholder('Type your private message here...').fill('secret');
  await page.getByLabel('Password (optional)').fill('short');

  await expect(page.getByText(/use at least 8 characters for the password/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create ShredNote' })).toBeDisabled();

  await page.getByLabel('Password (optional)').fill('long-enough-password');
  await expect(page.getByRole('button', { name: 'Create ShredNote' })).toBeEnabled();
});

test('turning off confirmation reveals the note immediately', async ({ page, context }) => {
  const message = 'no confirmation needed';

  await openComposerOptions(page);
  await page.getByPlaceholder('Type your private message here...').fill(message);
  await page.getByLabel('Confirm before showing the message').uncheck();
  const link = await submitAndGetLink(page);

  const recipient = await context.newPage();
  await recipient.goto(link);
  await expect(recipient.locator('pre')).toHaveText(message);
});

test('the reference label is shown to the recipient before they open the note', async ({
  page,
  context,
}) => {
  await openComposerOptions(page);
  await page.getByPlaceholder('Type your private message here...').fill('wifi: guest-network');
  await page.getByLabel('Reference label (optional)').fill('WiFi password');
  await expect(page.getByText('This label is not encrypted.')).toBeVisible();
  const link = await submitAndGetLink(page);

  const recipient = await context.newPage();
  await recipient.goto(link);
  await expect(recipient.getByText('WiFi password')).toBeVisible();
  // The label is shown, the message is not.
  await expect(recipient.locator('pre')).toHaveCount(0);
});

test('a short expiry is honoured and shown on the success screen', async ({ page }) => {
  await openComposerOptions(page);
  await page.getByPlaceholder('Type your private message here...').fill('expires soon');
  await page.getByLabel('Expiration').selectOption('1h');
  await submitAndGetLink(page);

  const notice = page.getByText(/this note is deleted automatically on/i);
  await expect(notice).toBeVisible();
});

test('"Create another" returns to an empty composer with defaults restored', async ({ page }) => {
  await openComposerOptions(page);
  await page.getByPlaceholder('Type your private message here...').fill('first note');
  await page.getByLabel('Password (optional)').fill('a-password');
  await submitAndGetLink(page);

  await page.getByRole('button', { name: 'Create another' }).click();

  const textarea = page.getByPlaceholder('Type your private message here...');
  await expect(textarea).toHaveValue('');
  await expect(textarea).toBeFocused();

  await page.getByRole('button', { name: 'More options' }).click();
  await expect(page.getByLabel('Password (optional)')).toHaveValue('');
  await expect(page.getByLabel('Expiration')).toHaveValue('read');
});
