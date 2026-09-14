import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { encryptNote } from '@/lib/crypto/core';
import { MAX_PASSWORD_ATTEMPTS } from '@/lib/notes/constants';
import {
  cleanupNotes,
  consumeNote,
  createNote,
  describeNote,
  type CreateNoteInput,
} from '@/lib/notes/service';

import { prisma, resetDatabase } from '../helpers/db';

async function seal(message: string, password?: string): Promise<{
  input: CreateNoteInput;
  fragment: string;
}> {
  const { payload, fragment } = await encryptNote(message, password);
  return {
    input: {
      ciphertext: payload.ciphertext,
      iv: payload.iv,
      wrappedKey: payload.wrappedKey,
      wrapIv: payload.wrapIv,
      kdfSalt: payload.kdfSalt,
      kdfIterations: payload.kdfIterations,
      authToken: payload.authToken,
      expiry: 'read',
      requireConfirm: true,
    },
    fragment,
  };
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('createNote', () => {
  it('stores ciphertext only - no plaintext, no key, no password', async () => {
    const message = 'plaintext-canary-9f2a';
    const { input, fragment } = await seal(message, 'my-password');
    const { id } = await createNote({ ...input, label: 'Server login' });

    const row = await prisma.note.findUniqueOrThrow({ where: { id } });
    const serialized = JSON.stringify(row);

    expect(serialized).not.toContain(message);
    expect(serialized).not.toContain('my-password');
    expect(serialized).not.toContain(fragment.split('.')[1]);
    expect(serialized).not.toContain(input.authToken!);
    expect(row.passwordProtected).toBe(true);
    expect(row.authTokenHash).toBeTypeOf('string');
    expect(row.label).toBe('Server login');
  });

  it('generates unique, high-entropy, URL-safe ids', async () => {
    const { input } = await seal('x');
    const ids = new Set<string>();
    for (let i = 0; i < 25; i += 1) {
      const { id } = await createNote(input);
      expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/);
      ids.add(id);
    }
    expect(ids.size).toBe(25);
  });

  it('caps the lifetime of a note at 30 days', async () => {
    const { input } = await seal('x');
    const { expiresAt } = await createNote({ ...input, expiry: '30d' });
    expect(expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(1000 * 60 * 60 * 24 * 30 + 5000);
  });

  it('honours the 1 hour expiry option', async () => {
    const { input } = await seal('x');
    const { expiresAt } = await createNote({ ...input, expiry: '1h' });
    const hours = (expiresAt.getTime() - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(0.9);
    expect(hours).toBeLessThan(1.1);
  });
});

describe('describeNote', () => {
  it('describes a live note without consuming it', async () => {
    const { input } = await seal('x', 'pw');
    const { id } = await createNote({ ...input, label: 'WiFi password' });

    const described = await describeNote(id);
    expect(described).toMatchObject({ id, passwordProtected: true, label: 'WiFi password' });

    // Still readable afterwards.
    await expect(consumeNote(id, input.authToken)).resolves.toMatchObject({ status: 'ok' });
  });

  it('returns null for unknown, consumed and expired ids alike', async () => {
    expect(await describeNote('AAAAAAAAAAAAAAAAAAAAAA')).toBeNull();

    const { input } = await seal('x');
    const consumed = await createNote({ ...input, authToken: undefined });
    await consumeNote(consumed.id);
    expect(await describeNote(consumed.id)).toBeNull();

    const expired = await createNote({ ...input, authToken: undefined });
    await prisma.note.update({
      where: { id: expired.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await describeNote(expired.id)).toBeNull();
  });
});

describe('consumeNote - single use', () => {
  it('returns the ciphertext once and never again', async () => {
    const { input } = await seal('one time only');
    const { id } = await createNote({ ...input, authToken: undefined });

    const first = await consumeNote(id);
    expect(first.status).toBe('ok');

    const second = await consumeNote(id);
    expect(second.status).toBe('gone');
    const third = await consumeNote(id);
    expect(third.status).toBe('gone');
  });

  it('blanks the stored ciphertext in the same statement that claims it', async () => {
    const message = 'scrub-me-canary';
    const { input } = await seal(message);
    const { id } = await createNote({ ...input, authToken: undefined });

    await consumeNote(id);

    const row = await prisma.note.findUniqueOrThrow({ where: { id } });
    expect(row.ciphertext).toBe('');
    expect(row.wrappedKey).toBe('');
    expect(row.consumedAt).not.toBeNull();
    expect(row.purgedAt).not.toBeNull();
  });

  it('gives the note to exactly one of 40 simultaneous readers', async () => {
    const { input } = await seal('contested note');
    const { id } = await createNote({ ...input, authToken: undefined });

    const results = await Promise.all(
      Array.from({ length: 40 }, () => consumeNote(id)),
    );

    const winners = results.filter((result) => result.status === 'ok');
    expect(winners).toHaveLength(1);
    expect(results.filter((result) => result.status === 'gone')).toHaveLength(39);
    expect(winners[0]!.status === 'ok' && winners[0].note.ciphertext).toBe(input.ciphertext);
  });

  it('never returns the same ciphertext twice across repeated races', async () => {
    const seen = new Set<string>();
    for (let round = 0; round < 8; round += 1) {
      const { input } = await seal(`race-${round}`);
      const { id } = await createNote({ ...input, authToken: undefined });
      const results = await Promise.all(Array.from({ length: 12 }, () => consumeNote(id)));
      const successes = results.filter((r) => r.status === 'ok');
      expect(successes).toHaveLength(1);
      const ciphertext = successes[0]!.status === 'ok' ? successes[0].note.ciphertext : '';
      expect(seen.has(ciphertext)).toBe(false);
      seen.add(ciphertext);
    }
  });

  it('refuses expired notes', async () => {
    const { input } = await seal('stale');
    const { id } = await createNote({ ...input, authToken: undefined });
    await prisma.note.update({
      where: { id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await consumeNote(id)).toEqual({ status: 'gone' });
  });

  it('treats an unknown id exactly like a consumed one', async () => {
    expect(await consumeNote('ZZZZZZZZZZZZZZZZZZZZZZ')).toEqual({ status: 'gone' });
  });
});

describe('consumeNote - password protection', () => {
  it('asks for a password before consuming anything', async () => {
    const { input } = await seal('secret', 'pw-correct');
    const { id } = await createNote(input);

    expect(await consumeNote(id)).toEqual({ status: 'password_required' });

    // The note survived the prompt.
    const ok = await consumeNote(id, input.authToken);
    expect(ok.status).toBe('ok');
  });

  it('rejects a wrong password without destroying the note', async () => {
    const { input } = await seal('secret', 'pw-correct');
    const { id } = await createNote(input);

    const wrong = await consumeNote(id, 'not-the-right-token');
    expect(wrong).toEqual({
      status: 'invalid_password',
      attemptsRemaining: MAX_PASSWORD_ATTEMPTS - 1,
    });

    const row = await prisma.note.findUniqueOrThrow({ where: { id } });
    expect(row.consumedAt).toBeNull();
    expect(row.ciphertext).not.toBe('');

    expect((await consumeNote(id, input.authToken)).status).toBe('ok');
  });

  it('destroys the note after too many wrong passwords', async () => {
    const { input } = await seal('secret', 'pw-correct');
    const { id } = await createNote(input);

    for (let attempt = 1; attempt < MAX_PASSWORD_ATTEMPTS; attempt += 1) {
      const result = await consumeNote(id, `wrong-${attempt}`);
      expect(result).toEqual({
        status: 'invalid_password',
        attemptsRemaining: MAX_PASSWORD_ATTEMPTS - attempt,
      });
    }

    expect(await consumeNote(id, 'wrong-final')).toEqual({ status: 'destroyed' });

    const row = await prisma.note.findUniqueOrThrow({ where: { id } });
    expect(row.ciphertext).toBe('');
    expect(row.consumedAt).not.toBeNull();

    // Even the correct password cannot bring it back.
    expect(await consumeNote(id, input.authToken)).toEqual({ status: 'gone' });
  });
});

describe('cleanupNotes', () => {
  it('deletes expired notes and old tombstones, and scrubs stragglers', async () => {
    const { input } = await seal('x');

    const expired = await createNote({ ...input, authToken: undefined });
    await prisma.note.update({
      where: { id: expired.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const straggler = await createNote({ ...input, authToken: undefined });
    await prisma.note.update({
      where: { id: straggler.id },
      data: { consumedAt: new Date(), purgedAt: null },
    });

    const oldTombstone = await createNote({ ...input, authToken: undefined });
    await prisma.note.update({
      where: { id: oldTombstone.id },
      data: {
        consumedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8),
        purgedAt: new Date(),
        ciphertext: '',
        wrappedKey: '',
      },
    });

    const live = await createNote({ ...input, authToken: undefined });

    const result = await cleanupNotes();
    expect(result.expiredDeleted).toBe(1);
    expect(result.consumedDeleted).toBe(1);
    expect(result.scrubbed).toBe(1);

    expect(await prisma.note.findUnique({ where: { id: expired.id } })).toBeNull();
    expect(await prisma.note.findUnique({ where: { id: oldTombstone.id } })).toBeNull();
    expect(await prisma.note.findUnique({ where: { id: live.id } })).not.toBeNull();

    const scrubbed = await prisma.note.findUniqueOrThrow({ where: { id: straggler.id } });
    expect(scrubbed.ciphertext).toBe('');
    expect(scrubbed.purgedAt).not.toBeNull();
  });
});
