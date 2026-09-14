import { NextResponse, type NextRequest } from 'next/server';

/**
 * Content-Security-Policy with a per-request nonce.
 *
 * This is the main structural defence against XSS: even if a bug allowed
 * attacker-controlled markup onto a page, `script-src 'nonce-...'` means the
 * browser will not execute it. Next.js reads the nonce out of the CSP header
 * we set on the *request* and stamps it onto its own inline bootstrap scripts.
 *
 * `'strict-dynamic'` lets Next's nonced bootstrap load the chunks it needs
 * without us enumerating them. `object-src 'none'` and `base-uri 'none'` close
 * the classic plugin and base-tag injection routes. `frame-ancestors 'none'`
 * stops the note reader from being framed and clickjacked into revealing a
 * message.
 *
 * NOTE: `style-src` allows 'unsafe-inline'. Nonced styles are incompatible
 * with React's inline style attributes, and inline CSS cannot execute script.
 *
 * TRADE-OFF: a per-request nonce means pages that emit inline structured data
 * render dynamically rather than statically. For a security product that is
 * the right way round, and the pages are small enough that it costs a couple
 * of milliseconds.
 */
export default function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-inline'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    // No third-party endpoints: ShredNote talks to nothing but itself.
    "connect-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    "manifest-src 'self'",
    'upgrade-insecure-requests',
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    /*
     * Every route except static assets, which are immutable and need no
     * per-request header work.
     */
    {
      source: '/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.svg|robots.txt|sitemap.xml).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
