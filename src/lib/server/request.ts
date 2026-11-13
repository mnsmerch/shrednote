/**
 * Request identity helpers.
 *
 * SECURITY / PRIVACY: raw IP addresses are never stored. They are turned into
 * a keyed HMAC-SHA256 digest used solely as a rate-limit bucket key. Without
 * SERVER_SECRET the digest cannot be reversed or correlated across
 * deployments, and rotating that secret erases all correlation.
 */
import { createHmac } from 'node:crypto';

import { serverSecret } from './env';

/**
 * Extracts the client IP.
 *
 * On Vercel only the headers its edge sets and overwrites are trusted, so a
 * client cannot choose its own bucket by sending a forged `x-forwarded-for`.
 * Elsewhere (local development, tests, a self-hosted proxy) the left-most
 * `x-forwarded-for` entry is used; that is only as trustworthy as the proxy
 * in front, which must overwrite the header rather than append to it.
 */
function clientIp(request: Request): string {
  const headers = request.headers;
  const candidates = process.env.VERCEL
    ? [headers.get('x-vercel-forwarded-for')?.split(',')[0], headers.get('x-real-ip')]
    : [headers.get('x-forwarded-for')?.split(',')[0], headers.get('x-real-ip')];
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value) return value;
  }
  // No forwarded header at all - direct connections in development, or a
  // misconfigured proxy. Everyone shares one bucket, which fails safe (more
  // limiting, not less) and is loud enough to notice.
  return 'unknown';
}

/**
 * Stable, non-reversible bucket key for a client.
 *
 * `salt` narrows how long the key stays stable: passing the current day, for
 * example, yields a key that cannot be correlated with yesterday's.
 */
export function clientKey(request: Request, scope: string, salt = ''): string {
  return `${scope}:${createHmac('sha256', serverSecret())
    .update(`client-ip:v1|${salt}|${clientIp(request)}`)
    .digest('base64url')
    .slice(0, 32)}`;
}
