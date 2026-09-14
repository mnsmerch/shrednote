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
 * Only the left-most entry of `x-forwarded-for` is used, and only because
 * Vercel and comparable platforms overwrite that header at the edge. Behind a
 * proxy that does not, set TRUSTED_PROXY_HEADER accordingly.
 */
function clientIp(request: Request): string {
  const headers = request.headers;
  const candidates = [
    headers.get('x-vercel-forwarded-for'),
    headers.get('x-real-ip'),
    headers.get('x-forwarded-for')?.split(',')[0],
  ];
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value) return value;
  }
  // No forwarded header at all - direct connections in development, or a
  // misconfigured proxy. Everyone shares one bucket, which fails safe (more
  // limiting, not less) and is loud enough to notice.
  return 'unknown';
}

/** Stable, non-reversible bucket key for a client. */
export function clientKey(request: Request, scope: string): string {
  return `${scope}:${createHmac('sha256', serverSecret())
    .update(clientIp(request))
    .digest('base64url')
    .slice(0, 32)}`;
}
