import { expect, test } from './fixtures';

import { E2E_ADMIN_PASSWORD } from '../playwright.config';

test.describe('admin dashboard', () => {
  test('is unreachable without the password', async ({ page }) => {
    await page.goto('/admin');

    await expect(page.getByRole('heading', { name: 'ShredNote admin' })).toBeVisible();
    await expect(page.getByLabel('Admin password')).toBeVisible();
    // No metrics rendered before authentication.
    await expect(page.getByText('Notes created')).toHaveCount(0);
  });

  test('rejects a wrong password without saying why', async ({ page }) => {
    await page.goto('/admin');
    await page.getByLabel('Admin password').fill('definitely-not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.locator('main').getByRole('alert')).toContainText('Incorrect password.');
    await expect(page.getByText('Notes created')).toHaveCount(0);
  });

  test('the stats API refuses unauthenticated callers', async ({ request }) => {
    const response = await request.get('/api/admin/stats');
    expect(response.status()).toBe(401);
    expect(await response.text()).not.toContain('notesCreated');
  });

  test('signs in, shows aggregate metrics and no note content, then signs out', async ({
    page,
    context,
  }) => {
    // Create a note first so the dashboard has something to count.
    const secret = 'admin-must-never-see-this-1234';
    await page.goto('/');
    await page.getByPlaceholder('Type your private message here...').fill(secret);
    await page.getByRole('button', { name: 'More options' }).click();
    await page.getByLabel('Reference label (optional)').fill('a private label');
    await page.getByRole('button', { name: 'Create ShredNote' }).click();
    await expect(page.locator('#shrednote-link')).toBeVisible();

    const admin = await context.newPage();
    await admin.goto('/admin');
    await admin.getByLabel('Admin password').fill(E2E_ADMIN_PASSWORD);
    await admin.getByRole('button', { name: 'Sign in' }).click();

    await expect(admin.getByText('Notes created')).toBeVisible();
    await expect(admin.getByText('Awaiting a reader')).toBeVisible();
    await expect(admin.getByText('Rate limit events')).toBeVisible();
    await expect(admin.getByText('Ciphertext stored')).toBeVisible();

    // The dashboard cannot show note contents, labels or identifiers.
    const rendered = await admin.content();
    expect(rendered).not.toContain(secret);
    expect(rendered).not.toContain('a private label');

    await admin.getByRole('button', { name: 'Sign out' }).click();
    await expect(admin.getByLabel('Admin password')).toBeVisible();
  });

  test('the admin page is excluded from search engines', async ({ page, request }) => {
    await page.goto('/admin');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

    const robots = await request.get('/robots.txt');
    expect(await robots.text()).toContain('Disallow: /admin');
  });
});
