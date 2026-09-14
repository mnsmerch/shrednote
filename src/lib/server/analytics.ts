/**
 * Admin dashboard data.
 *
 * PRIVACY BOUNDARY: every query in this file returns counts, sizes and
 * timestamps. None of them select `ciphertext`, `wrappedKey`, `iv`,
 * `authTokenHash` or `label`, and none return a note id. The dashboard is
 * therefore incapable of exposing note contents even to the site owner -
 * which is the only honest way to run a product like this.
 */
import { prisma } from './db';

export interface DailyPoint {
  day: string;
  created: number;
  consumed: number;
  expired: number;
  visits: number;
  rateLimited: number;
  failedPasswords: number;
}

export interface AdminOverview {
  totals: {
    created: number;
    consumed: number;
    expired: number;
    destroyedByBruteForce: number;
    rateLimitEvents: number;
    failedPasswordAttempts: number;
    noteLinkVisits: number;
  };
  live: {
    /** Notes currently waiting to be read. */
    pending: number;
    /** Consumed tombstones still held for the "already shredded" answer. */
    tombstones: number;
    /** Notes past their expiry that cleanup has not removed yet. */
    awaitingCleanup: number;
    passwordProtected: number;
    expiringWithin24h: number;
  };
  storage: {
    /** Bytes of ciphertext currently stored. */
    ciphertextBytes: number;
    /** Total on-disk size of the notes table including indexes. */
    notesTableBytes: number;
    databaseBytes: number;
  };
  health: {
    databaseReachable: boolean;
    databaseLatencyMs: number;
    /** Rows whose ciphertext should have been scrubbed but has not been. */
    unscrubbedConsumed: number;
    rateLimitBuckets: number;
    serverTime: string;
  };
  daily: DailyPoint[];
}

const DAYS = 30;

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const startedAt = Date.now();
  const now = new Date();
  const since = new Date(now.getTime() - (DAYS - 1) * 24 * 60 * 60 * 1000);
  const tombstoneCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    stats,
    pending,
    tombstones,
    awaitingCleanup,
    passwordProtected,
    expiringSoon,
    unscrubbed,
    rateLimitBuckets,
    sizeRows,
    ciphertextBytes,
  ] = await Promise.all([
    prisma.dailyStat.findMany({
      where: { day: { gte: new Date(dayKey(since)) } },
      orderBy: { day: 'asc' },
    }),
    prisma.note.count({ where: { consumedAt: null, expiresAt: { gt: now } } }),
    prisma.note.count({ where: { consumedAt: { gte: tombstoneCutoff } } }),
    prisma.note.count({ where: { consumedAt: null, expiresAt: { lte: now } } }),
    prisma.note.count({
      where: { consumedAt: null, expiresAt: { gt: now }, passwordProtected: true },
    }),
    prisma.note.count({
      where: {
        consumedAt: null,
        expiresAt: { gt: now, lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.note.count({ where: { consumedAt: { not: null }, purgedAt: null } }),
    prisma.rateLimit.count(),
    prisma.$queryRaw<Array<{ notes: bigint; database: bigint }>>`
      SELECT pg_total_relation_size('notes') AS notes,
             pg_database_size(current_database()) AS database
    `,
    prisma.note.aggregate({ _sum: { byteSize: true }, where: { purgedAt: null } }),
  ]);

  const totals = stats.reduce(
    (accumulator, row) => ({
      created: accumulator.created + row.notesCreated,
      consumed: accumulator.consumed + row.notesConsumed,
      expired: accumulator.expired + row.notesExpired,
      destroyedByBruteForce: accumulator.destroyedByBruteForce + row.notesDestroyedByBrute,
      rateLimitEvents: accumulator.rateLimitEvents + row.rateLimitHits,
      failedPasswordAttempts: accumulator.failedPasswordAttempts + row.failedPasswordAttempts,
      noteLinkVisits: accumulator.noteLinkVisits + row.noteLinkVisits,
    }),
    {
      created: 0,
      consumed: 0,
      expired: 0,
      destroyedByBruteForce: 0,
      rateLimitEvents: 0,
      failedPasswordAttempts: 0,
      noteLinkVisits: 0,
    },
  );

  // Fill gaps so the chart has one point per day rather than a ragged series.
  const byDay = new Map(stats.map((row) => [dayKey(row.day), row]));
  const daily: DailyPoint[] = [];
  for (let offset = DAYS - 1; offset >= 0; offset -= 1) {
    const day = dayKey(new Date(now.getTime() - offset * 24 * 60 * 60 * 1000));
    const row = byDay.get(day);
    daily.push({
      day,
      created: row?.notesCreated ?? 0,
      consumed: row?.notesConsumed ?? 0,
      expired: row?.notesExpired ?? 0,
      visits: row?.noteLinkVisits ?? 0,
      rateLimited: row?.rateLimitHits ?? 0,
      failedPasswords: row?.failedPasswordAttempts ?? 0,
    });
  }

  const sizes = sizeRows[0];

  return {
    totals,
    live: {
      pending,
      tombstones,
      awaitingCleanup,
      passwordProtected,
      expiringWithin24h: expiringSoon,
    },
    storage: {
      ciphertextBytes: ciphertextBytes._sum.byteSize ?? 0,
      notesTableBytes: Number(sizes?.notes ?? 0n),
      databaseBytes: Number(sizes?.database ?? 0n),
    },
    health: {
      databaseReachable: true,
      databaseLatencyMs: Date.now() - startedAt,
      unscrubbedConsumed: unscrubbed,
      rateLimitBuckets,
      serverTime: now.toISOString(),
    },
    daily,
  };
}
