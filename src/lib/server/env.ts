/**
 * Server-side environment access.
 *
 * Values are read lazily so that `next build` succeeds in environments where
 * runtime secrets are injected later, while any request that actually needs a
 * secret fails loudly and safely instead of falling back to a default.
 *
 * No secret in here is ever sent to the client: only variables prefixed with
 * NEXT_PUBLIC_ are inlined into the browser bundle, and the only one we use is
 * the public site URL.
 */

if (typeof window !== 'undefined') {
  throw new Error('lib/server/env must never be imported into client code');
}

class MissingEnvError extends Error {
  constructor(name: string) {
    super(`Missing required environment variable: ${name}`);
    this.name = 'MissingEnvError';
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new MissingEnvError(name);
  }
  return value;
}

function optional(name: string): string | null {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : null;
}

/** Secret used to HMAC IP addresses and sign admin sessions. */
export function serverSecret(): string {
  const secret = required('SERVER_SECRET');
  if (secret.length < 32) {
    throw new Error('SERVER_SECRET must be at least 32 characters of random data');
  }
  return secret;
}

/** scrypt hash of the admin password, produced by `npm run admin:hash`. */
export function adminPasswordHash(): string | null {
  return optional('ADMIN_PASSWORD_HASH');
}

export function cronSecret(): string | null {
  return optional('CRON_SECRET');
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}
