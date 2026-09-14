/**
 * Fixed-window rate limiting backed by PostgreSQL.
 *
 * Why Postgres and not Redis: the limiter needs a single atomic
 * read-modify-write, which `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`
 * provides in one round trip. Keeping it in the database we already run
 * removes a moving part, a second connection pool and a second place where
 * request metadata could leak. Swapping in Redis later means reimplementing
 * `consume()` alone.
 *
 * Buckets are keyed by an HMAC of the client IP (see request.ts) so no raw
 * address is ever written to disk.
 */
import { prisma } from './db';
import { log } from './logging';

export interface RateLimitRule {
  /** Requests allowed per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  /** Seconds until the current window rolls over. */
  retryAfter: number;
}

/**
 * Limits tuned for anonymous use: generous enough that a human never notices,
 * tight enough that scripted abuse stops being worthwhile.
 */
export const RATE_LIMITS = {
  /** Creating notes. */
  create: { limit: 20, windowSeconds: 60 * 10 } satisfies RateLimitRule,
  /** Looking up note metadata - the endpoint an enumeration attack would hit. */
  lookup: { limit: 60, windowSeconds: 60 * 10 } satisfies RateLimitRule,
  /** Actually consuming notes. */
  consume: { limit: 30, windowSeconds: 60 * 10 } satisfies RateLimitRule,
  /** Password attempts, per client. Per-note attempts are capped separately. */
  password: { limit: 15, windowSeconds: 60 * 10 } satisfies RateLimitRule,
  /** Admin sign-in attempts. */
  adminLogin: { limit: 8, windowSeconds: 60 * 15 } satisfies RateLimitRule,
} as const;

export async function consume(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = rule.windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const expiresAt = new Date(windowStart.getTime() + windowMs);

  try {
    // One statement, one round trip, atomic under concurrency: the ON CONFLICT
    // branch resets the counter when the stored window is stale, otherwise it
    // increments in place.
    const rows = await prisma.$queryRaw<Array<{ count: number }>>`
      INSERT INTO "rate_limits" ("key", "windowStart", "count", "expiresAt")
      VALUES (${key}, ${windowStart}, 1, ${expiresAt})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "rate_limits"."windowStart" = ${windowStart} THEN "rate_limits"."count" + 1
          ELSE 1
        END,
        "windowStart" = ${windowStart},
        "expiresAt" = ${expiresAt}
      RETURNING "count"::int
    `;

    const count = rows[0]?.count ?? 1;
    const allowed = count <= rule.limit;
    return {
      allowed,
      limit: rule.limit,
      remaining: Math.max(0, rule.limit - count),
      retryAfter: Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000)),
    };
  } catch {
    // Fail closed on the write path would take the whole site down for a
    // transient database blip; fail open here but make it visible. The note
    // endpoints have independent protections (128-bit ids, per-note attempt
    // caps, single-use consumption).
    log.error({ event: 'rate_limit_unavailable' });
    return { allowed: true, limit: rule.limit, remaining: rule.limit, retryAfter: 0 };
  }
}

/** Removes expired buckets. Called by the scheduled cleanup job. */
export async function pruneRateLimits(): Promise<number> {
  const result = await prisma.rateLimit.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
