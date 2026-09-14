/**
 * Shared plumbing for the JSON API.
 *
 * Three security controls live here so that every route gets them uniformly:
 *   - responses are never cached or indexed;
 *   - errors are opaque enums with human copy, never exception text or stack
 *     traces (those can quote request payloads);
 *   - state-changing requests must come from our own origin, which is what
 *     stops cross-site requests from riding on the admin session cookie.
 */
import { consume, RATE_LIMITS, type RateLimitRule } from './rate-limit';
import { clientKey } from './request';
import { log } from './logging';
import { bump } from './stats';
import { siteUrl } from '@/lib/site';

export type ApiErrorCode =
  | 'invalid_request'
  | 'note_gone'
  | 'password_required'
  | 'invalid_password'
  | 'note_destroyed'
  | 'rate_limited'
  | 'forbidden'
  | 'unauthorized'
  | 'server_error';

const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  'X-Robots-Tag': 'noindex, nofollow',
} as const;

export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...NO_STORE,
      ...init.headers,
    },
  });
}

export function apiError(
  code: ApiErrorCode,
  status: number,
  message: string,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): Response {
  return json({ error: { code, message, ...extra } }, { status, headers });
}

/** Generic 500. Deliberately says nothing about what actually failed. */
export function serverError(route: string): Response {
  log.error({ event: 'unhandled_error', route });
  return apiError(
    'server_error',
    500,
    'Something went wrong on our side. Please try again in a moment.',
  );
}

/**
 * CSRF defence for state-changing endpoints.
 *
 * `Sec-Fetch-Site` is sent by every current browser and cannot be forged by
 * page JavaScript. The Origin header is checked as a fallback for older
 * clients. Requests with neither header are rejected, which also blocks the
 * classic cross-site HTML form attack (forms cannot set them).
 */
export function isSameOrigin(request: Request): boolean {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite) {
    return fetchSite === 'same-origin' || fetchSite === 'none';
  }

  const origin = request.headers.get('origin');
  if (origin) {
    try {
      const allowed = new Set([new URL(siteUrl).host, new URL(request.url).host]);
      return allowed.has(new URL(origin).host);
    } catch {
      return false;
    }
  }

  return false;
}

export function requireSameOrigin(request: Request): Response | null {
  if (isSameOrigin(request)) return null;
  return apiError('forbidden', 403, 'This request did not come from ShredNote.');
}

/**
 * Requests must be JSON. Rejecting other content types removes the only shape
 * of cross-origin request a browser will send without a preflight.
 */
export function requireJsonContentType(request: Request): Response | null {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.split(';')[0]?.trim().toLowerCase() === 'application/json') {
    return null;
  }
  return apiError('invalid_request', 415, 'Expected a JSON request body.');
}

/** Caps the body we are willing to buffer, before parsing it. */
export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new PayloadTooLargeError();
  }
  const text = await request.text();
  if (Buffer.byteLength(text, 'utf8') > maxBytes) {
    throw new PayloadTooLargeError();
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new MalformedJsonError();
  }
}

export class PayloadTooLargeError extends Error {}
export class MalformedJsonError extends Error {}

export type RateLimitName = keyof typeof RATE_LIMITS;

/**
 * Applies a rate limit and returns a ready-made 429 when the caller is over
 * budget, or null when the request may proceed.
 */
export async function enforceRateLimit(
  request: Request,
  name: RateLimitName,
  rule: RateLimitRule = RATE_LIMITS[name],
): Promise<Response | null> {
  const result = await consume(clientKey(request, name), rule);
  if (result.allowed) return null;

  log.warn({ event: 'rate_limited', route: name, limit: rule.limit });
  void bump('rateLimitHits');

  return apiError(
    'rate_limited',
    429,
    'Too many requests from this network. Please wait a moment and try again.',
    { retryAfter: result.retryAfter },
    { 'Retry-After': String(result.retryAfter) },
  );
}
