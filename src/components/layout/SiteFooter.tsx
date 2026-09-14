import Link from 'next/link';

import { ShredMark } from '@/components/brand/ShredMark';

const COLUMNS: Array<{ heading: string; links: Array<{ href: string; label: string }> }> = [
  {
    heading: 'Product',
    links: [
      { href: '/', label: 'Create a note' },
      { href: '/how-it-works', label: 'How it works' },
      { href: '/about', label: 'About' },
    ],
  },
  {
    heading: 'Use cases',
    links: [
      { href: '/send-password-securely', label: 'Send a password securely' },
      { href: '/self-destructing-note', label: 'Self-destructing note' },
      { href: '/one-time-secret', label: 'One-time secret' },
      { href: '/share-api-keys-securely', label: 'Share an API key' },
    ],
  },
  {
    heading: 'More',
    links: [
      { href: '/burn-after-reading-message', label: 'Burn after reading' },
      { href: '/temporary-private-message', label: 'Temporary private message' },
      { href: '/encrypted-note', label: 'Encrypted note' },
      { href: '/privacy', label: 'Privacy' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-canvas-raised">
      <div className="mx-auto max-w-5xl px-5 py-14 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5 text-ink">
              <span className="text-accent">
                <ShredMark className="h-6 w-6" />
              </span>
              <span className="font-semibold tracking-[-0.02em]">ShredNote</span>
            </div>
            <p className="mt-3 max-w-[24ch] text-sm leading-relaxed text-muted">
              Encrypted in your browser. Opened once. Gone.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.heading}>
              <h2 className="text-[0.8125rem] font-semibold tracking-wide text-ink uppercase">
                {column.heading}
              </h2>
              <ul className="mt-3.5 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted transition-colors hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-7 text-sm text-faint sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} ShredNote</p>
          <p className="max-w-prose">
            ShredNote reduces how long a secret is exposed. No tool can make sharing a secret risk
            free.
          </p>
        </div>
      </div>
    </footer>
  );
}
