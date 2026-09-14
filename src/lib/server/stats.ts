/**
 * Aggregate counters for the admin dashboard.
 *
 * PRIVACY: these are day-level integers only. Nothing here can be tied back to
 * a note, a link, a person or an IP address, which is exactly why the admin
 * dashboard is safe to expose to the site owner.
 */
import { prisma } from './db';
import { log } from './logging';

export type StatColumn =
  | 'notesCreated'
  | 'notesConsumed'
  | 'notesExpired'
  | 'noteLinkVisits'
  | 'rateLimitHits'
  | 'failedPasswordAttempts'
  | 'notesDestroyedByBrute';

/** Whitelist guards the identifier interpolated into the SQL below. */
const COLUMNS: readonly StatColumn[] = [
  'notesCreated',
  'notesConsumed',
  'notesExpired',
  'noteLinkVisits',
  'rateLimitHits',
  'failedPasswordAttempts',
  'notesDestroyedByBrute',
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Atomically bumps a counter for the current UTC day.
 *
 * Statistics must never be able to break a user request, so every failure is
 * swallowed after being logged.
 */
export async function bump(column: StatColumn, amount = 1): Promise<void> {
  if (!COLUMNS.includes(column)) {
    throw new Error(`Unknown stat column: ${column}`);
  }
  try {
    // The column name comes from the whitelist above, never from user input;
    // the values are bound parameters.
    await prisma.$executeRawUnsafe(
      `INSERT INTO "daily_stats" ("day", "${column}") VALUES ($1::date, $2)
       ON CONFLICT ("day") DO UPDATE SET "${column}" = "daily_stats"."${column}" + $2`,
      today(),
      amount,
    );
  } catch {
    log.error({ event: 'stats_write_failed', reason: column });
  }
}
