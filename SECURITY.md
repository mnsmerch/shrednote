# Security

## Reporting a vulnerability

Please report security issues privately rather than opening a public issue.
Include the affected URL or file, what an attacker can do, and how to reproduce
it. We will confirm receipt, keep you updated while we investigate, and credit
you when a fix ships unless you prefer otherwise.

Please do not run automated scanners against the production service, create
large volumes of notes, or attempt denial of service. Testing against a local
instance is always welcome.

## What we claim, and what we do not

ShredNote is **not** "100% secure" or "unhackable", and no honest service makes
that claim. What it does is remove the permanent copy of a secret and shorten
the window in which it is readable.

**In scope**, and things we consider bugs:

- Any way for the server, its logs, or its database to obtain a note's
  plaintext, decryption key, or password.
- Any way to read a note twice, or for two concurrent readers to both succeed.
- Any way to read a note without the URL fragment.
- Any way to bypass password protection or the wrong-attempt destruct limit.
- XSS, CSRF, SQL injection, or a way to defeat the rate limiting.
- Note enumeration, or a response that reveals whether a given id ever existed.
- Any way to reach the admin dashboard, or its API, without the password.

**Out of scope**, because they follow from the design rather than from a
defect:

- Anyone who obtains the full link can read the note. That is what the link is.
- A compromised device, browser extension, or someone reading over a shoulder.
- A recipient screenshotting, copying or forwarding a message they were sent.
- The inherent trust in browser-delivered JavaScript, which applies to every
  in-browser encryption tool.
- Missing security headers on endpoints that serve no content, or best-practice
  suggestions with no demonstrated impact.

## Design summary

| Property | Mechanism |
| --- | --- |
| Server cannot read notes | AES-256-GCM in the browser; key in the URL fragment, which browsers never transmit |
| Password never transmitted | PBKDF2-SHA256 (600,000 iterations); only an independent HKDF branch is sent as a proof |
| Wrong password does not destroy the note | Proof verified server-side, in constant time, before the note is claimed |
| Password cannot be ground down | Ten attempts, then the note destroys itself |
| Delivered at most once | Single atomic `UPDATE ... WHERE consumedAt IS NULL` that also blanks the ciphertext |
| No enumeration | 128-bit random ids; identical responses for unknown, expired and consumed |
| No secrets in logs | Logging accepts only an allowlist of scalar fields |
| XSS | Per-request CSP nonce with `strict-dynamic`; note bodies rendered as React text |
| CSRF | `Sec-Fetch-Site` / `Origin` checks plus JSON-only content type |
| Clickjacking | `frame-ancestors 'none'` and `X-Frame-Options: DENY` |

The reasoning is documented inline in `src/lib/crypto/core.ts` and
`src/lib/notes/service.ts`. Read both before changing either.

## Operator responsibilities

- Serve over HTTPS. The client-side encryption model assumes the JavaScript
  reaching the browser has not been tampered with in transit.
- Set `SERVER_SECRET` to at least 32 bytes of real randomness.
- Keep `ADMIN_PASSWORD_HASH` out of source control, and generate it with
  `npm run admin:hash` rather than by hand.
- Run the cleanup schedule. Without it, consumed tombstones and expired notes
  accumulate; the admin dashboard warns when that happens.
- Verify that your proxy sets the forwarded-IP header the rate limiter reads
  (see "Behind a proxy" in the README). If it does not, the limits collapse to
  a single global bucket.
