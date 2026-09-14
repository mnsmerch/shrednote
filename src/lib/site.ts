/**
 * Public site configuration. Safe to import from client components - it holds
 * no secrets.
 */

const DEFAULT_URL = 'http://localhost:3000';

function normalize(url: string): string {
  return url.replace(/\/+$/, '');
}

export const siteUrl = normalize(process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_URL);

export const site = {
  name: 'ShredNote',
  url: siteUrl,
  tagline: 'Send it. Read it. Shred it.',
  description:
    "Send private messages, passwords, and sensitive information with encrypted links that disappear after they're opened. No account required.",
  /** Keep in sync with the Note.expiresAt cap in lib/notes/constants.ts. */
  maxNoteAgeDays: 30,
} as const;

export function absoluteUrl(path: string): string {
  return `${siteUrl}${path.startsWith('/') ? path : `/${path}`}`;
}
