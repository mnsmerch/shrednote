import type { Metadata } from 'next';
import Link from 'next/link';

import { Composer } from '@/components/composer/Composer';
import { JsonLd } from '@/components/seo/JsonLd';
import { site, siteUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: 'ShredNote | Send Private Self Destructing Notes',
  description: site.description,
  alternates: { canonical: '/' },
};

const PRINCIPLES = [
  {
    title: 'Encrypted in your browser',
    body: 'Your message is encrypted with AES-256 before it leaves your device. We receive an unreadable block of ciphertext and the key stays in your link.',
    icon: (
      <path
        d="M7 10V7.5a5 5 0 0 1 10 0V10M6 10h12a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5v-7A1.5 1.5 0 0 1 6 10Z"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    title: 'Opened only once',
    body: 'The first person to open the link gets the message. It is claimed in a single atomic step, so a second reader — or a second tab — always finds it gone.',
    icon: (
      <path
        d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Zm9.5 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    title: 'Deleted automatically',
    body: 'Reading a note erases the ciphertext in the same database statement that hands it over. Unread notes are deleted when they expire.',
    icon: (
      <path
        d="M5 7h14M10 7V5.5A1.5 1.5 0 0 1 11.5 4h1A1.5 1.5 0 0 1 14 5.5V7m3 0-.7 11.1a2 2 0 0 1-2 1.9H9.7a2 2 0 0 1-2-1.9L7 7m3.5 4v5m3-5v5"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
];

const USE_CASES = [
  { label: 'Passwords', href: '/send-password-securely' },
  { label: 'WiFi credentials', href: '/send-password-securely' },
  { label: 'API keys', href: '/share-api-keys-securely' },
  { label: 'Private messages', href: '/temporary-private-message' },
  { label: 'Access codes', href: '/one-time-secret' },
  { label: 'Temporary information', href: '/burn-after-reading-message' },
];

export default function HomePage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'WebSite',
              '@id': `${siteUrl}/#website`,
              url: siteUrl,
              name: 'ShredNote',
              description: site.description,
              inLanguage: 'en',
              publisher: { '@id': `${siteUrl}/#organization` },
            },
            {
              '@type': 'Organization',
              '@id': `${siteUrl}/#organization`,
              name: 'ShredNote',
              url: siteUrl,
              logo: `${siteUrl}/icon.svg`,
            },
            {
              '@type': 'WebApplication',
              '@id': `${siteUrl}/#app`,
              name: 'ShredNote',
              url: siteUrl,
              applicationCategory: 'SecurityApplication',
              operatingSystem: 'Any modern web browser',
              browserRequirements: 'Requires the Web Crypto API',
              description: site.description,
              featureList: [
                'End-to-end encrypted notes',
                'Self-destructing one-time links',
                'Optional password protection',
                'Optional expiry from 1 hour to 30 days',
                'No account required',
              ],
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            },
          ],
        }}
      />

      {/* Hero + tool, deliberately above the fold. */}
      <section className="mx-auto max-w-3xl px-5 pt-12 pb-4 sm:px-6 sm:pt-16">
        <h1 className="text-center text-[2.25rem] leading-[1.08] font-semibold tracking-[-0.035em] text-ink sm:text-[3.25rem]">
          Send it. Read it. Shred it.
        </h1>
        <p className="mx-auto mt-4 max-w-[46ch] text-center text-[1.0625rem] leading-relaxed text-muted sm:mt-5 sm:text-lg">
          Share passwords, private messages, and sensitive information with a link that disappears
          after it&rsquo;s opened.
        </p>

        <div className="mt-8 sm:mt-10">
          <Composer />
        </div>

        <p className="mt-5 text-center text-[0.875rem] text-faint">
          Free. No account, no email, no tracking on note pages.
        </p>
      </section>

      {/* Private by design */}
      <section className="mx-auto mt-20 max-w-5xl px-5 sm:mt-28 sm:px-6" aria-labelledby="private">
        <h2
          id="private"
          className="text-center text-[1.75rem] font-semibold tracking-[-0.025em] text-ink sm:text-[2.125rem]"
        >
          Private by design.
        </h2>
        <p className="mx-auto mt-3 max-w-[52ch] text-center text-[1.0625rem] leading-relaxed text-muted">
          Not a promise on a marketing page — a consequence of how the product is built.
        </p>

        <ul className="mt-10 grid gap-5 sm:mt-12 sm:grid-cols-3">
          {PRINCIPLES.map((principle) => (
            <li key={principle.title} className="sn-card p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  className="h-[1.35rem] w-[1.35rem]"
                  aria-hidden="true"
                >
                  {principle.icon}
                </svg>
              </span>
              <h3 className="mt-4 text-[1.0625rem] font-semibold text-ink">{principle.title}</h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">{principle.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Perfect for sharing */}
      <section
        className="mx-auto mt-20 max-w-5xl px-5 sm:mt-28 sm:px-6"
        aria-labelledby="perfect-for"
      >
        <div className="sn-card overflow-hidden">
          <div className="p-7 sm:p-10">
            <h2
              id="perfect-for"
              className="text-[1.75rem] font-semibold tracking-[-0.025em] text-ink sm:text-[2.125rem]"
            >
              Perfect for sharing
            </h2>
            <p className="mt-3 max-w-[58ch] text-[1.0625rem] leading-relaxed text-muted">
              Anything you would otherwise paste into a chat thread that keeps it forever.
            </p>

            <ul className="mt-7 flex flex-wrap gap-2.5">
              {USE_CASES.map((useCase) => (
                <li key={useCase.label}>
                  <Link
                    href={useCase.href}
                    className="inline-flex rounded-full border border-line bg-surface-inset px-4 py-2 text-[0.9375rem] font-medium text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
                  >
                    {useCase.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-line bg-warning-soft px-7 py-6 sm:px-10">
            <h3 className="text-[0.9375rem] font-semibold text-warning">
              ShredNote is not a password manager.
            </h3>
            <p className="mt-1.5 max-w-[70ch] text-[0.9375rem] leading-relaxed text-warning">
              Use it to hand a secret over once. For credentials you keep using, store them in a
              dedicated password manager such as 1Password, Bitwarden or your browser&rsquo;s built-in
              manager, and rotate anything you share. A note that has been read is gone — it is
              delivery, not storage.
            </p>
          </div>
        </div>
      </section>

      {/* Closing explainer */}
      <section className="mx-auto mt-20 max-w-3xl px-5 text-center sm:mt-28 sm:px-6">
        <h2 className="text-[1.5rem] font-semibold tracking-[-0.02em] text-ink sm:text-[1.75rem]">
          Want the details?
        </h2>
        <p className="mx-auto mt-3 max-w-[52ch] text-[1.0625rem] leading-relaxed text-muted">
          We explain exactly what happens to your message, what we can see (very little) and what we
          cannot protect you from.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/how-it-works"
            className="inline-flex h-11 items-center rounded-xl border border-line-strong bg-surface px-5 text-[0.9375rem] font-semibold text-ink transition-colors hover:bg-surface-muted"
          >
            How it works
          </Link>
          <Link
            href="/privacy"
            className="inline-flex h-11 items-center rounded-xl px-5 text-[0.9375rem] font-semibold text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
          >
            Privacy
          </Link>
        </div>
      </section>
    </>
  );
}
