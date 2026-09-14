/**
 * Note lifecycle: create, describe, consume, clean up.
 * =============================================================================
 * The single most important property of ShredNote lives in this file:
 *
 *   A note is delivered AT MOST ONCE, even if a thousand requests for it
 *   arrive in the same millisecond.
 *
 * That is enforced by one UPDATE statement whose WHERE clause includes
 * `"consumedAt" IS NULL`. PostgreSQL serialises concurrent updates of the same
 * row: the first writer wins, every other writer re-evaluates the predicate
 * against the committed row, sees a non-null `consumedAt`, and matches zero
 * rows. No advisory locks, no application-level coordination, no window in
 * which two readers can both be handed the ciphertext.
 *
 * The same statement scrubs the ciphertext columns. It reads the pre-update
 * values through a self-join (`FROM "notes" old`), which evaluates against the
 * statement's snapshot, so RETURNING hands back the ciphertext the caller
 * needs while the stored row is already blank.
 */
import { createHash, timingSafeEqual } from 'node:crypto';

import { prisma } from '@/lib/server/db';
import { generateNoteId } from '@/lib/server/ids';
import { log } from '@/lib/server/logging';
import { bump } from '@/lib/server/stats';

import {
  MAX_PASSWORD_ATTEMPTS,
  type ExpiryOption,
  ttlSecondsFor,
} from './constants';

export interface CreateNoteInput {
  ciphertext: string;
  iv: string;
  wrappedKey: string;
  wrapIv: string;
  kdfSalt: string;
  kdfIterations: number;
  /** Client-derived proof of password knowledge. Never the password itself. */
  authToken?: string;
  expiry: ExpiryOption;
  requireConfirm: boolean;
  label?: string;
}

export interface CreatedNote {
  id: string;
  expiresAt: Date;
}

export interface NoteDescription {
  id: string;
  passwordProtected: boolean;
  requireConfirm: boolean;
  label: string | null;
  expiresAt: Date;
  /**
   * PBKDF2 parameters. These are not secret - a salt and an iteration count
   * are useless without the link fragment and the password - and the
   * recipient's browser needs them to derive the password proof *before* the
   * note is consumed, so that a typo does not destroy the message.
   */
  kdfSalt: string;
  kdfIterations: number;
}

export interface SealedNote {
  ciphertext: string;
  iv: string;
  wrappedKey: string;
  wrapIv: string;
  kdfSalt: string;
  kdfIterations: number;
}

export type ConsumeResult =
  | { status: 'ok'; note: SealedNote }
  /** Consumed, expired, deleted or never existed - deliberately the same answer. */
  | { status: 'gone' }
  | { status: 'password_required' }
  | { status: 'invalid_password'; attemptsRemaining: number }
  /** Too many wrong passwords: the note destroyed itself. */
  | { status: 'destroyed' };

/**
 * Hashes the client's auth token before storage.
 *
 * The token is already a 256-bit HKDF output, so a single SHA-256 is the right
 * primitive here: there is nothing to slow down: an attacker cannot guess a
 * 256-bit value, and the expensive PBKDF2 step that protects the human-chosen
 * password already happened in the browser.
 */
function hashAuthToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('base64url');
}

/** Constant-time comparison that tolerates differing lengths. */
function secureEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');
  if (bufferA.length !== bufferB.length) {
    // Still burn a comparison so the fast path is not obviously shorter.
    timingSafeEqual(bufferA, bufferA);
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}

export async function createNote(input: CreateNoteInput): Promise<CreatedNote> {
  const ttlSeconds = ttlSecondsFor(input.expiry);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  const id = generateNoteId();

  await prisma.note.create({
    data: {
      id,
      ciphertext: input.ciphertext,
      iv: input.iv,
      wrappedKey: input.wrappedKey,
      wrapIv: input.wrapIv,
      kdfSalt: input.kdfSalt,
      kdfIterations: input.kdfIterations,
      passwordProtected: Boolean(input.authToken),
      authTokenHash: input.authToken ? hashAuthToken(input.authToken) : null,
      requireConfirm: input.requireConfirm,
      label: input.label && input.label.length > 0 ? input.label : null,
      byteSize: Buffer.byteLength(input.ciphertext, 'utf8'),
      expiresAt,
    },
  });

  // Note id is intentionally absent: logs must not become a note index.
  log.info({
    event: 'note_created',
    ttlSeconds,
    passwordProtected: Boolean(input.authToken),
    requireConfirm: input.requireConfirm,
  });
  void bump('notesCreated');

  return { id, expiresAt };
}

/**
 * Returns what the recipient's browser needs to render the interstitial,
 * without consuming anything.
 *
 * Returns null for missing, consumed and expired notes alike so the endpoint
 * cannot be used to prove that a given id ever existed.
 */
export async function describeNote(id: string): Promise<NoteDescription | null> {
  const note = await prisma.note.findFirst({
    where: { id, consumedAt: null, expiresAt: { gt: new Date() } },
    select: {
      id: true,
      passwordProtected: true,
      requireConfirm: true,
      label: true,
      expiresAt: true,
      kdfSalt: true,
      kdfIterations: true,
    },
  });
  return note ?? null;
}

/**
 * Atomically claims and returns a note, destroying it in the same statement.
 */
export async function consumeNote(id: string, authToken?: string): Promise<ConsumeResult> {
  const now = new Date();

  // Step 1: read the gate fields. This is only a pre-check; it grants nothing.
  const gate = await prisma.note.findUnique({
    where: { id },
    select: {
      consumedAt: true,
      expiresAt: true,
      passwordProtected: true,
      authTokenHash: true,
      failedAttempts: true,
    },
  });

  if (!gate || gate.consumedAt !== null || gate.expiresAt <= now) {
    return { status: 'gone' };
  }

  // Step 2: verify the password proof in Node, not in SQL, so the comparison
  // is constant-time. A SQL `=` on the stored hash would leak it byte by byte
  // under a timing attack, and anyone holding the link could then grind the
  // password offline.
  if (gate.passwordProtected && gate.authTokenHash) {
    if (!authToken) {
      return { status: 'password_required' };
    }
    if (!secureEquals(hashAuthToken(authToken), gate.authTokenHash)) {
      void bump('failedPasswordAttempts');

      // Increment in the database rather than from the value we read above:
      // two simultaneous wrong guesses would otherwise both write the same
      // number, and the attempt cap could be overshot.
      const counted = await prisma.$queryRaw<Array<{ failedAttempts: number }>>`
        UPDATE "notes"
        SET "failedAttempts" = "failedAttempts" + 1
        WHERE "id" = ${id} AND "consumedAt" IS NULL
        RETURNING "failedAttempts"::int AS "failedAttempts"
      `;
      const attempts = counted[0]?.failedAttempts ?? gate.failedAttempts + 1;

      if (attempts >= MAX_PASSWORD_ATTEMPTS) {
        // Destroy rather than lock: a locked note is a note an attacker can
        // keep hammering, and the sender can always send a new one.
        await prisma.note
          .updateMany({
            where: { id, consumedAt: null },
            data: { consumedAt: now, purgedAt: now, ciphertext: '', wrappedKey: '' },
          })
          .catch(() => undefined);
        log.warn({ event: 'note_destroyed_brute_force', attempts });
        void bump('notesDestroyedByBrute');
        return { status: 'destroyed' };
      }

      return {
        status: 'invalid_password',
        attemptsRemaining: Math.max(0, MAX_PASSWORD_ATTEMPTS - attempts),
      };
    }
  }

  // Step 3: the atomic claim. Everything above is advisory; this statement is
  // the actual single-use guarantee.
  //
  //  - `n."consumedAt" IS NULL` makes the claim idempotent under concurrency.
  //  - `FROM "notes" old` re-reads the row from the statement snapshot so
  //    RETURNING yields the ciphertext as it was *before* this UPDATE blanked
  //    it. The row is written exactly once.
  //  - The auth token hash is re-checked here as defence in depth.
  const expectedHash = gate.authTokenHash;
  const rows = await prisma.$queryRaw<
    Array<{
      ciphertext: string;
      iv: string;
      wrappedKey: string;
      wrapIv: string;
      kdfSalt: string;
      kdfIterations: number;
    }>
  >`
    UPDATE "notes" AS n
    SET "consumedAt" = ${now},
        "purgedAt" = ${now},
        "ciphertext" = '',
        "wrappedKey" = ''
    FROM "notes" AS old
    WHERE n."id" = old."id"
      AND n."id" = ${id}
      AND n."consumedAt" IS NULL
      AND n."expiresAt" > ${now}
      AND (n."authTokenHash" IS NULL OR n."authTokenHash" = ${expectedHash})
    RETURNING
      old."ciphertext" AS "ciphertext",
      old."iv" AS "iv",
      old."wrappedKey" AS "wrappedKey",
      old."wrapIv" AS "wrapIv",
      old."kdfSalt" AS "kdfSalt",
      old."kdfIterations"::int AS "kdfIterations"
  `;

  const claimed = rows[0];
  if (!claimed) {
    // Someone else won the race in the microseconds since the pre-check.
    return { status: 'gone' };
  }

  log.info({ event: 'note_consumed' });
  void bump('notesConsumed');

  return { status: 'ok', note: claimed };
}

export interface CleanupResult {
  expiredDeleted: number;
  consumedDeleted: number;
  scrubbed: number;
}

/**
 * Scheduled maintenance.
 *
 *  - expired notes are deleted outright (their ciphertext was never read);
 *  - consumed rows are kept only briefly as tombstones so a second visit can
 *    be answered, then removed entirely;
 *  - any consumed row that still holds ciphertext (for example because a
 *    process died mid-request) is scrubbed.
 */
export async function cleanupNotes(now = new Date()): Promise<CleanupResult> {
  const scrubbed = await prisma.note.updateMany({
    where: { consumedAt: { not: null }, purgedAt: null },
    data: { ciphertext: '', wrappedKey: '', purgedAt: now },
  });

  const expired = await prisma.note.deleteMany({
    where: { expiresAt: { lt: now }, consumedAt: null },
  });

  // Tombstone window: after this the id simply stops existing, which produces
  // exactly the same "gone" response.
  const tombstoneCutoff = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 7);
  const consumed = await prisma.note.deleteMany({
    where: { consumedAt: { lt: tombstoneCutoff } },
  });

  if (expired.count > 0) {
    void bump('notesExpired', expired.count);
  }

  log.info({
    event: 'cleanup_completed',
    deleted: expired.count + consumed.count,
    purged: scrubbed.count,
  });

  return {
    expiredDeleted: expired.count,
    consumedDeleted: consumed.count,
    scrubbed: scrubbed.count,
  };
}
