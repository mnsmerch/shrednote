import { describe, expect, it, vi } from 'vitest';

import {
  ADMIN_SESSION_SECONDS,
  createAdminSession,
  hashAdminPassword,
  verifyAdminPassword,
  verifyAdminSession,
} from '@/lib/server/admin';
import { log } from '@/lib/server/logging';
import { generateNoteId, isValidNoteId } from '@/lib/server/ids';
import { createNoteSchema } from '@/lib/notes/validation';

describe('note identifiers', () => {
  it('are 22 URL-safe characters and unique across many draws', () => {
    const ids = new Set<string>();
    for (let index = 0; index < 5_000; index += 1) {
      const id = generateNoteId();
      expect(isValidNoteId(id)).toBe(true);
      ids.add(id);
    }
    expect(ids.size).toBe(5_000);
  });

  it('rejects anything that is not exactly the expected shape', () => {
    for (const candidate of [
      '',
      'short',
      'A'.repeat(21),
      'A'.repeat(23),
      'AAAAAAAAAAAAAAAAAAAA/=',
      '../../../etc/passwd',
      'AAAAAAAAAAAAAAAAAAAA%00',
      null,
      undefined,
      42,
    ]) {
      expect(isValidNoteId(candidate)).toBe(false);
    }
  });

  it('draws from the full alphabet rather than a predictable prefix', () => {
    const alphabet = new Set<string>();
    for (let index = 0; index < 400; index += 1) {
      for (const character of generateNoteId()) alphabet.add(character);
    }
    // 64-character alphabet; seeing most of it rules out a broken generator.
    expect(alphabet.size).toBeGreaterThan(50);
  });
});

describe('admin password handling', () => {
  it('never stores the password and verifies the right one', () => {
    const password = 'a-long-enough-admin-password';
    const hash = hashAdminPassword(password);

    expect(hash).not.toContain(password);
    expect(hash.startsWith('scrypt$')).toBe(true);

    process.env.ADMIN_PASSWORD_HASH = hash;
    expect(verifyAdminPassword(password)).toBe(true);
    expect(verifyAdminPassword('not-the-password')).toBe(false);
    expect(verifyAdminPassword('')).toBe(false);
    delete process.env.ADMIN_PASSWORD_HASH;
  });

  it('salts each hash, so identical passwords do not collide', () => {
    expect(hashAdminPassword('same-password')).not.toBe(hashAdminPassword('same-password'));
  });

  it('refuses every password when no hash is configured', () => {
    delete process.env.ADMIN_PASSWORD_HASH;
    expect(verifyAdminPassword('anything')).toBe(false);
  });

  it('refuses a malformed stored hash instead of throwing', () => {
    for (const broken of ['', 'nonsense', 'scrypt$1$2$3', 'bcrypt$1$8$1$aa$bb']) {
      process.env.ADMIN_PASSWORD_HASH = broken;
      expect(verifyAdminPassword('anything')).toBe(false);
    }
    delete process.env.ADMIN_PASSWORD_HASH;
  });
});

describe('admin sessions', () => {
  it('accepts a freshly issued token and rejects tampering', () => {
    const { token, maxAge } = createAdminSession();
    expect(maxAge).toBe(ADMIN_SESSION_SECONDS);
    expect(verifyAdminSession(token)).toBe(true);

    const [expiry, nonce, signature] = token.split('.');
    expect(verifyAdminSession(`${expiry}.${nonce}.${'A'.repeat(signature!.length)}`)).toBe(false);
    // Extending the expiry invalidates the signature.
    expect(verifyAdminSession(`${Number(expiry) + 10_000}.${nonce}.${signature}`)).toBe(false);
    expect(verifyAdminSession('not-a-token')).toBe(false);
    expect(verifyAdminSession(undefined)).toBe(false);
    expect(verifyAdminSession('')).toBe(false);
  });

  it('expires', () => {
    const { token } = createAdminSession();
    const afterExpiry = Date.now() + (ADMIN_SESSION_SECONDS + 60) * 1000;
    expect(verifyAdminSession(token, afterExpiry)).toBe(false);
  });
});

describe('logging', () => {
  it('drops every field that is not on the allow list', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    log.info({
      event: 'note_created',
      // None of the following may ever reach a log line.
      plaintext: 'my secret message',
      encryptionKey: 'AAAA',
      fragment: '1.BBBB',
      password: 'hunter2',
      ip: '203.0.113.7',
      noteId: 'abcdefghijklmnopqrstuv',
    } as never);

    expect(spy).toHaveBeenCalledTimes(1);
    const line = spy.mock.calls[0]![0] as string;

    expect(line).toContain('note_created');
    for (const forbidden of [
      'my secret message',
      'AAAA',
      '1.BBBB',
      'hunter2',
      '203.0.113.7',
      'abcdefghijklmnopqrstuv',
    ]) {
      expect(line).not.toContain(forbidden);
    }

    spy.mockRestore();
  });

  it('truncates long values so a payload cannot be smuggled through an allowed field', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    log.warn({ event: 'x'.repeat(5_000) });
    const line = spy.mock.calls[0]![0] as string;
    expect(line.length).toBeLessThan(400);
    spy.mockRestore();
  });
});

describe('create-note validation', () => {
  const valid = {
    version: 1 as const,
    ciphertext: 'abc123',
    iv: 'aaaa',
    wrappedKey: 'bbbb',
    wrapIv: 'cccc',
    kdfSalt: 'dddd',
    kdfIterations: 0,
    expiry: 'read' as const,
    requireConfirm: true,
  };

  it('accepts a well-formed payload', () => {
    expect(createNoteSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an unsupported version, expiry or extra field', () => {
    expect(createNoteSchema.safeParse({ ...valid, version: 2 }).success).toBe(false);
    expect(createNoteSchema.safeParse({ ...valid, expiry: 'forever' }).success).toBe(false);
    expect(createNoteSchema.safeParse({ ...valid, sneaky: true }).success).toBe(false);
  });

  it('rejects a password-protected note with a weakened work factor', () => {
    expect(
      createNoteSchema.safeParse({ ...valid, authToken: 'abcd', kdfIterations: 1_000 }).success,
    ).toBe(false);
    expect(
      createNoteSchema.safeParse({ ...valid, authToken: 'abcd', kdfIterations: 600_000 }).success,
    ).toBe(true);
  });

  it('rejects iterations on a note with no password', () => {
    expect(createNoteSchema.safeParse({ ...valid, kdfIterations: 600_000 }).success).toBe(false);
  });
});
