# ShredNote

Send private messages, passwords and sensitive information with a link that
disappears after it is opened.

ShredNote encrypts notes **in the browser**. The server stores ciphertext it
cannot read, and the decryption key travels in the URL fragment — the part
after `#`, which browsers never transmit. Reading a note destroys it in the
same database statement that hands it over.

```
https://shrednote.com/n/Yb3kQ1r8hTn2wVxA0cLmZq#1.pV7s2Nn4kX0aQdR9tLcE8yUmB6gJfH3wZ1oS5iT2rKq
                       └──────── note id ────┘ └──────── key, never sent ─────────────────┘
```

---

## Table of contents

- [Security model](#security-model)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Testing](#testing)
- [Deployment](#deployment)
- [Operations](#operations)
- [Project layout](#project-layout)
- [Future work](#future-work)

---

## Security model

### What the browser does

1. Generates a 256-bit content key with the platform CSPRNG.
2. Encrypts the message with **AES-256-GCM** (96-bit nonce, 128-bit tag).
3. Generates a 256-bit **link secret**, encoded into the URL fragment.
4. Derives a wrapping key from the link secret with **HKDF-SHA256** and
   encrypts the content key under it.
5. Uploads ciphertext only.

With a password, the password is stretched with **PBKDF2-HMAC-SHA256 at
600,000 iterations** and mixed with the link secret before key derivation, so
both halves are required.

### What the server never receives

| Never received       | Why                                                    |
| -------------------- | ------------------------------------------------------ |
| Plaintext message    | Encryption happens before the request is made          |
| Encryption key       | Lives in the URL fragment, which browsers do not send  |
| Password             | Only an HKDF-derived proof is sent, never the password |
| URL fragment         | Not in the request line, headers, or any log           |

### Password verification without weakening the model

A wrong password must not destroy the note, so the server has to check it
*before* consuming anything. The browser derives two independent HKDF branches
from the same material:

- `shrednote:wrap:v1` → the key that decrypts the note. Stays on the device.
- `shrednote:auth:v1` → a proof of knowledge. Sent to the server, which stores
  only its SHA-256.

Because the proof is derived from the link secret **and** the password, a
stolen database cannot be used to guess the password offline — the attacker
would also need a link they do not have. And because HKDF branches are
computationally independent, the proof grants no ability to decrypt.

After ten wrong attempts a note destroys itself.

### Single-use consumption

The critical invariant — *a note is delivered at most once* — is enforced by a
single SQL statement in `src/lib/notes/service.ts`:

```sql
UPDATE "notes" AS n
SET "consumedAt" = $now, "purgedAt" = $now, "ciphertext" = '', "wrappedKey" = ''
FROM "notes" AS old
WHERE n."id" = old."id" AND n."id" = $id
  AND n."consumedAt" IS NULL AND n."expiresAt" > $now
RETURNING old."ciphertext", old."iv", old."wrappedKey", ...
```

PostgreSQL serialises concurrent updates of the same row, so the first writer
wins and every other writer re-evaluates `consumedAt IS NULL` against the
committed row and matches zero rows. The `FROM "notes" AS old` self-join reads
the pre-update values from the statement snapshot, so `RETURNING` yields the
ciphertext the caller needs while the stored row is already blank. There is no
window in which a note is both delivered and still stored.

`tests/integration/note-service.test.ts` fires 40 simultaneous requests at one
note and asserts that exactly one succeeds.

### Other controls

- **ID enumeration** — 128-bit random ids; unknown, expired and consumed ids
  return byte-identical responses; lookups are rate limited.
- **Rate limiting** — fixed-window counters in PostgreSQL, keyed by an HMAC of
  the client IP. Separate budgets for creating, looking up, consuming and
  password attempts.
- **XSS** — per-request CSP nonce with `strict-dynamic`; note contents are
  rendered as React text children, never as HTML.
- **CSRF** — `Sec-Fetch-Site` and `Origin` checks plus a JSON-only content type
  on every state-changing endpoint.
- **SQL injection** — Prisma with bound parameters throughout; the one
  interpolated identifier (a stat column name) comes from a hard-coded
  allowlist.
- **Logging** — `src/lib/server/logging.ts` accepts only an allowlist of scalar
  fields, so a note body, key or password cannot be logged even by mistake.
- **Clickjacking** — `frame-ancestors 'none'` and `X-Frame-Options: DENY`.
- **Caching** — note pages and API responses are `no-store` and `noindex`.

### What ShredNote does not claim

It is not "100% secure" or "unhackable". It cannot protect a secret from
someone who obtains the link first, from a compromised device on either end,
or from a recipient who takes a screenshot. Like every in-browser encryption
tool, it requires trusting that the JavaScript served is the JavaScript
documented. These limits are stated plainly on `/how-it-works` and `/privacy`
rather than buried.

---

## Architecture

| Layer     | Choice                                                   |
| --------- | -------------------------------------------------------- |
| Framework | Next.js 16 (App Router), React 19, TypeScript strict      |
| Styling   | Tailwind CSS v4, system font stack (zero network fonts)   |
| Database  | PostgreSQL via Prisma                                     |
| Crypto    | Web Crypto API only — no third-party crypto dependencies  |
| Tests     | Vitest (unit + integration), Playwright (end-to-end)      |

**Why no Redis.** Rate limiting needs one atomic read-modify-write, which
`INSERT ... ON CONFLICT DO UPDATE ... RETURNING` provides in a single round
trip. Using the database we already run removes a moving part and a second
place where request metadata could accumulate. If you outgrow it, reimplement
`consume()` in `src/lib/server/rate-limit.ts` — nothing else needs to change.

Runtime dependencies: `next`, `react`, `react-dom`, `@prisma/client`, `zod`.
That is the complete list.

---

## Getting started

Requirements: Node 20.11+ and PostgreSQL 14+.

```bash
git clone <repository-url> shrednote
cd shrednote
npm install

cp .env.example .env.local
# Fill in DATABASE_URL and generate a SERVER_SECRET:
#   openssl rand -base64 48

npx prisma migrate deploy
npm run dev
```

Open <http://localhost:3000>.

To use the admin dashboard locally, generate a password hash and add it to
`.env.local`:

```bash
npm run admin:hash
```

---

## Environment variables

| Variable               | Required   | Purpose                                                          |
| ---------------------- | ---------- | ---------------------------------------------------------------- |
| `DATABASE_URL`         | yes        | PostgreSQL connection string                                     |
| `NEXT_PUBLIC_SITE_URL` | yes        | Canonical origin, used for links, canonicals and the sitemap     |
| `SERVER_SECRET`        | yes        | 32+ random bytes; HMACs rate-limit keys and signs admin sessions |
| `ADMIN_PASSWORD_HASH`  | admin only | scrypt hash from `npm run admin:hash`                            |
| `CRON_SECRET`          | cleanup    | Bearer token for `/api/cron/cleanup`                             |

No secret is inlined into the browser bundle: only `NEXT_PUBLIC_*` variables
reach the client, and the only one used is the site URL.

Rotating `SERVER_SECRET` invalidates admin sessions and makes existing
rate-limit digests meaningless — both are safe, intentional consequences.

---

## Testing

```bash
npm run typecheck   # TypeScript, strict
npm run lint        # ESLint
npm test            # Vitest: unit + integration (needs a Postgres database)
npm run test:e2e    # Playwright: real browser against a production build
```

Integration and end-to-end tests use a real PostgreSQL database, because the
properties worth testing only exist in that combination. Point them somewhere
disposable:

```bash
createdb shrednote_test
DATABASE_URL=postgresql://localhost:5432/shrednote_test npx prisma migrate deploy
npm test
```

Override with `TEST_DATABASE_URL` (Vitest) or `E2E_DATABASE_URL` (Playwright).

What the suites cover:

- Encryption round-trips, tamper detection, key independence, malformed links.
- **The key and plaintext never reaching the backend** — asserted both at the
  payload level and by recording every request a real browser makes.
- Single-use consumption under concurrency, expiry, cleanup.
- Password protection, wrong passwords, the brute-force destruct limit.
- Rate limiting, CSRF rejection, injection payloads, oversized bodies.
- XSS: a note containing a script tag renders as text and executes nothing.
- Mobile layout, keyboard navigation, labelling, and announced errors.
- Admin authentication, and that the dashboard renders no note data.

---

## Deployment

Designed for Vercel plus any managed PostgreSQL (Neon, Supabase, RDS).

1. Create the database and run `npx prisma migrate deploy` against it.
2. Set the environment variables above in your hosting provider.
3. Deploy. `npm run build` runs `prisma generate` first.

`vercel.json` schedules the cleanup job hourly. On another platform, call the
same endpoint from your scheduler:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/cleanup
```

HTTPS is assumed in production: `Strict-Transport-Security` and
`upgrade-insecure-requests` are sent on every response, and the admin session
cookie is marked `Secure` outside development.

### Behind a proxy

Rate limiting reads the client IP from `x-vercel-forwarded-for`, `x-real-ip`,
then the left-most `x-forwarded-for` entry. That is correct on platforms that
overwrite those headers at the edge. If yours does not, adjust `clientIp()` in
`src/lib/server/request.ts` before relying on the limits.

---

## Operations

- **Admin dashboard** — `/admin`. Shows notes created, read and expired, daily
  volume, storage usage, rate-limit events and database health. It is built on
  `src/lib/server/analytics.ts`, which selects no note contents, keys, labels
  or identifiers — the dashboard cannot leak a note because the data is not in
  the query.
- **Cleanup** — deletes expired notes, removes consumed tombstones after seven
  days, and scrubs any consumed row that still holds ciphertext (for example
  after a process died mid-request). The dashboard warns if that count grows,
  which means the schedule is not running.

---

## Project layout

```
prisma/schema.prisma          Data model; cannot represent a readable note
src/lib/crypto/               Encryption core (browser + Node compatible)
src/lib/notes/                Lifecycle, limits, wire validation
src/lib/server/               Database, rate limiting, logging, admin, analytics
src/lib/client/               Browser API client
src/app/api/                  Route handlers
src/app/                      Pages: composer, reader, content, admin
src/components/               UI, composer, reader, marketing, admin
tests/                        Vitest unit + integration
e2e/                          Playwright end-to-end
```

Security-relevant code is deliberately concentrated in `src/lib/crypto/core.ts`
and `src/lib/notes/service.ts`. Both carry extended comments explaining the
reasoning; read them before changing anything in either.

---

## Future work

The public product is intended to stay free and account-free. The architecture
leaves room for a paid tier — longer expiry, larger messages, file attachments,
custom domains, team accounts, an API, audit metadata — without changing the
encryption model: notes are already opaque blobs with independent metadata, so
ownership and quotas can be layered on top rather than cut through the middle.

---

## Licence

MIT
