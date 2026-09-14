import { describe, expect, it } from 'vitest';

import {
  CRYPTO_VERSION,
  DecryptionError,
  decodeFragment,
  decryptNote,
  deriveAuthToken,
  encryptNote,
} from '@/lib/crypto/core';
import { base64UrlToBytes, bytesToBase64Url } from '@/lib/crypto/encoding';

describe('base64url encoding', () => {
  it('round-trips arbitrary bytes', () => {
    for (let length = 0; length < 130; length += 7) {
      const bytes = new Uint8Array(new ArrayBuffer(length));
      crypto.getRandomValues(bytes);
      expect(Array.from(base64UrlToBytes(bytesToBase64Url(bytes)))).toEqual(Array.from(bytes));
    }
  });

  it('produces URL-safe output only', () => {
    const bytes = new Uint8Array(new ArrayBuffer(256));
    for (let i = 0; i < 256; i += 1) bytes[i] = i;
    expect(bytesToBase64Url(bytes)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('rejects malformed input instead of silently truncating', () => {
    expect(() => base64UrlToBytes('not valid!!')).toThrow();
  });
});

describe('encryptNote / decryptNote', () => {
  it('round-trips a note with no password', async () => {
    const message = 'hunter2 is not a good password';
    const { payload, fragment } = await encryptNote(message);
    expect(payload.version).toBe(CRYPTO_VERSION);
    await expect(decryptNote(payload, fragment)).resolves.toBe(message);
  });

  it('round-trips unicode, emoji and newlines', async () => {
    const message = 'Ünïcödé ✅ 🔐\nline two\ttabbed\r\nline three — em dash';
    const { payload, fragment } = await encryptNote(message);
    await expect(decryptNote(payload, fragment)).resolves.toBe(message);
  });

  it('round-trips a large note', async () => {
    const message = 'A'.repeat(25_000);
    const { payload, fragment } = await encryptNote(message);
    await expect(decryptNote(payload, fragment)).resolves.toBe(message);
  });

  it('never places plaintext, the key or the fragment in the payload', async () => {
    const message = 'super-secret-canary-string';
    const { payload, fragment } = await encryptNote(message);
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain(message);
    expect(serialized).not.toContain(fragment);
    expect(serialized).not.toContain(fragment.split('.')[1]);
    // The payload must only ever contain these keys.
    expect(Object.keys(payload).sort()).toEqual([
      'ciphertext',
      'iv',
      'kdfIterations',
      'kdfSalt',
      'version',
      'wrapIv',
      'wrappedKey',
    ]);
  });

  it('uses a fresh key, iv and salt for every note', async () => {
    const a = await encryptNote('same message');
    const b = await encryptNote('same message');
    expect(a.payload.ciphertext).not.toBe(b.payload.ciphertext);
    expect(a.payload.iv).not.toBe(b.payload.iv);
    expect(a.payload.kdfSalt).not.toBe(b.payload.kdfSalt);
    expect(a.fragment).not.toBe(b.fragment);
  });

  it('produces a 256-bit link secret', async () => {
    const { fragment } = await encryptNote('x');
    const { version, linkSecret } = decodeFragment(fragment);
    expect(version).toBe(CRYPTO_VERSION);
    expect(linkSecret.length).toBe(32);
  });

  it('fails to decrypt with the wrong fragment', async () => {
    const { payload } = await encryptNote('secret');
    const other = await encryptNote('decoy');
    await expect(decryptNote(payload, other.fragment)).rejects.toBeInstanceOf(DecryptionError);
  });

  it('rejects a tampered ciphertext (AES-GCM authentication)', async () => {
    const { payload, fragment } = await encryptNote('transfer $10 to alice');
    const bytes = base64UrlToBytes(payload.ciphertext);
    bytes[0] = (bytes[0]! ^ 0xff) & 0xff;
    const tampered = { ...payload, ciphertext: bytesToBase64Url(bytes) };
    await expect(decryptNote(tampered, fragment)).rejects.toBeInstanceOf(DecryptionError);
  });

  it('rejects a tampered wrapped key', async () => {
    const { payload, fragment } = await encryptNote('secret');
    const bytes = base64UrlToBytes(payload.wrappedKey);
    bytes[1] = (bytes[1]! ^ 0x01) & 0xff;
    await expect(
      decryptNote({ ...payload, wrappedKey: bytesToBase64Url(bytes) }, fragment),
    ).rejects.toBeInstanceOf(DecryptionError);
  });

  it('rejects a malformed fragment', async () => {
    const { payload } = await encryptNote('secret');
    await expect(decryptNote(payload, 'garbage')).rejects.toBeInstanceOf(DecryptionError);
    await expect(decryptNote(payload, '1.tooshort')).rejects.toBeInstanceOf(DecryptionError);
  });
});

describe('password protection', () => {
  it('requires both the link and the password', async () => {
    const message = 'db root password';
    const { payload, fragment } = await encryptNote(message, 'correct horse battery staple');

    await expect(decryptNote(payload, fragment, 'correct horse battery staple')).resolves.toBe(
      message,
    );
    await expect(decryptNote(payload, fragment, 'wrong password')).rejects.toBeInstanceOf(
      DecryptionError,
    );
    await expect(decryptNote(payload, fragment, '')).rejects.toBeInstanceOf(DecryptionError);
  });

  it('emits an auth token that is independent of the decryption key', async () => {
    const { payload, fragment } = await encryptNote('secret', 'pw');
    expect(payload.authToken).toBeTypeOf('string');
    expect(payload.kdfIterations).toBeGreaterThanOrEqual(600_000);

    // Knowing the auth token must not help unwrap anything: it appears nowhere
    // in the stored material.
    const stored = JSON.stringify({ ...payload, authToken: undefined });
    expect(stored).not.toContain(payload.authToken);

    const recomputed = await deriveAuthToken(fragment, 'pw', payload.kdfSalt, payload.kdfIterations);
    expect(recomputed).toBe(payload.authToken);

    const wrong = await deriveAuthToken(fragment, 'nope', payload.kdfSalt, payload.kdfIterations);
    expect(wrong).not.toBe(payload.authToken);
  });

  it('binds the auth token to the link secret, so the server cannot brute force it', async () => {
    const a = await encryptNote('secret', 'shared-password');
    const b = await encryptNote('secret', 'shared-password');
    // Same password, different links -> unrelated tokens. A database thief has
    // no fragment, so no offline guessing attack is available.
    expect(a.payload.authToken).not.toBe(b.payload.authToken);

    const crossToken = await deriveAuthToken(
      b.fragment,
      'shared-password',
      a.payload.kdfSalt,
      a.payload.kdfIterations,
    );
    expect(crossToken).not.toBe(a.payload.authToken);
  });

  it('does not emit an auth token when there is no password', async () => {
    const { payload } = await encryptNote('secret');
    expect(payload.authToken).toBeUndefined();
    expect(payload.kdfIterations).toBe(0);
  });
});
