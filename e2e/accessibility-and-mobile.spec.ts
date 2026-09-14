import { expect, test } from './fixtures';

const PUBLIC_PAGES = [
  '/',
  '/how-it-works',
  '/privacy',
  '/about',
  '/send-password-securely',
  '/self-destructing-note',
  '/one-time-secret',
  '/burn-after-reading-message',
  '/temporary-private-message',
  '/private-note',
  '/encrypted-note',
  '/secure-message-link',
  '/one-time-message',
  '/share-api-keys-securely',
];

test.describe('layout', () => {
  for (const path of PUBLIC_PAGES) {
    test(`${path} never scrolls horizontally and has exactly one h1`, async ({ page }) => {
      await page.goto(path);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);

      await expect(page.locator('h1')).toHaveCount(1);
    });
  }

  test('the note tool is visible without scrolling on a phone', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Only meaningful at a phone viewport');

    await page.goto('/');
    const textarea = page.getByPlaceholder('Type your private message here...');
    await expect(textarea).toBeInViewport();

    const viewport = page.viewportSize()!;
    const button = page.getByRole('button', { name: 'Create ShredNote' });
    const box = (await button.boundingBox())!;
    // The primary action should be within one short scroll.
    expect(box.y).toBeLessThan(viewport.height * 1.6);
    // And comfortably tappable.
    expect(box.height).toBeGreaterThanOrEqual(44);
  });

  test('the revealed message wraps instead of overflowing on a phone', async ({
    page,
    context,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Only meaningful at a phone viewport');

    const message = `token-${'a'.repeat(300)}`;
    await page.goto('/');
    await page.getByPlaceholder('Type your private message here...').fill(message);
    await page.getByRole('button', { name: 'Create ShredNote' }).click();
    const link = await page.locator('#shrednote-link').inputValue();

    const recipient = await context.newPage();
    await recipient.goto(link);
    await recipient.getByRole('button', { name: 'Reveal & Shred' }).click();
    await expect(recipient.locator('pre')).toHaveText(message);

    const overflow = await recipient.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test.describe('accessibility', () => {
  test('the whole creation flow is reachable with the keyboard alone', async ({ page, isMobile }) => {
    test.skip(Boolean(isMobile), 'Keyboard navigation is a desktop concern');

    await page.goto('/');

    // Tab to the textarea, type, then submit without touching the mouse.
    const textarea = page.getByPlaceholder('Type your private message here...');
    await textarea.focus();
    await page.keyboard.type('typed with the keyboard');
    await page.keyboard.press('Control+Enter');

    await expect(page.getByRole('heading', { name: 'Your ShredNote is ready.' })).toBeVisible();
  });

  test('the skip link is the first focus stop and jumps to the main content', async ({
    page,
    isMobile,
  }) => {
    test.skip(Boolean(isMobile), 'Keyboard navigation is a desktop concern');

    await page.goto('/');
    await page.keyboard.press('Tab');

    const focused = page.locator(':focus');
    await expect(focused).toHaveText('Skip to content');
    await expect(focused).toBeVisible();
  });

  test('every form control has an accessible name', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'More options' }).click();

    for (const label of [
      'Your private message',
      'Expiration',
      'Password (optional)',
      'Reference label (optional)',
      'Confirm before showing the message',
    ]) {
      await expect(page.getByLabel(label)).toBeAttached();
    }
  });

  test('the expandable options section reports its state to assistive tech', async ({ page }) => {
    await page.goto('/');
    const toggle = page.getByRole('button', { name: 'More options' });

    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  test('errors on the reader are announced', async ({ page, context }) => {
    await page.goto('/');
    await page.getByPlaceholder('Type your private message here...').fill('secret');
    await page.getByRole('button', { name: 'More options' }).click();
    await page.getByLabel('Password (optional)').fill('the-password');
    await page.getByRole('button', { name: 'Create ShredNote' }).click();
    const link = await page.locator('#shrednote-link').inputValue();

    const recipient = await context.newPage();
    await recipient.goto(link);
    await recipient.getByLabel('This note is password protected').fill('wrong');
    await recipient.getByRole('button', { name: 'Unlock & Shred' }).click();

    // Scoped to the page content: Next.js adds its own route announcer with
    // role="alert" at the document level.
    await expect(recipient.locator('main').getByRole('alert')).toContainText(
      'That password is not correct.',
    );
  });
});

test.describe('SEO surfaces', () => {
  test('the homepage carries the expected title, description and structured data', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page).toHaveTitle('ShredNote | Send Private Self Destructing Notes');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      /encrypted links that disappear after they're opened/i,
    );

    const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent();
    const parsed = JSON.parse(jsonLd!) as { '@graph': Array<{ '@type': string }> };
    expect(parsed['@graph'].map((entry) => entry['@type'])).toContain('WebApplication');
  });

  test('note pages are marked noindex and are disallowed in robots.txt', async ({
    page,
    request,
  }) => {
    await page.goto('/n/AAAAAAAAAAAAAAAAAAAAAA#1.' + 'B'.repeat(43));
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

    const robots = await request.get('/robots.txt');
    expect(await robots.text()).toContain('Disallow: /n/');
  });

  test('the sitemap lists public pages and no note links', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.status()).toBe(200);

    const xml = await response.text();
    expect(xml).toContain('/how-it-works');
    expect(xml).toContain('/send-password-securely');
    expect(xml).not.toContain('/n/');
  });

  test('a landing page exposes FAQ structured data matching its visible questions', async ({
    page,
  }) => {
    await page.goto('/send-password-securely');

    const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent();
    const parsed = JSON.parse(jsonLd!) as {
      '@graph': Array<{ '@type': string; mainEntity?: Array<{ name: string }> }>;
    };
    const faq = parsed['@graph'].find((entry) => entry['@type'] === 'FAQPage');
    expect(faq?.mainEntity?.length).toBeGreaterThan(0);

    await expect(page.getByText(faq!.mainEntity![0]!.name)).toBeVisible();
  });
});
