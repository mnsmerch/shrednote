/**
 * ShredNote end-to-end encryption.
 * =============================================================================
 * THIS FILE IS THE SECURITY CORE OF THE PRODUCT. Read the model before editing.
 *
 * Threat model
 * ------------
 * We assume the ShredNote server is honest-but-curious and may be compromised.
 * A full database dump must not reveal a single note. That holds because the
 * only material capable of decrypting a note - the link secret - lives in the
 * URL fragment, and browsers never send fragments to servers.
 *
 * Key schedule
 * ------------
 *   S   linkSecret       32 random bytes, base64url-encoded into `#...`
 *   P   password         optional, user-chosen, never transmitted anywhere
 *   M   PBKDF2-SHA256(P, salt, iterations, 32 bytes)   (empty when no password)
 *   IKM S || M
 *
 *   wrappingKey = HKDF-SHA256(IKM, salt, "shrednote:wrap:v1")  -> AES-256-GCM
 *   authToken   = HKDF-SHA256(IKM, salt, "shrednote:auth:v1")  -> 32 bytes
 *
 *   contentKey  = 32 random bytes (AES-256-GCM), wrapped under `wrappingKey`
 *   ciphertext  = AES-256-GCM(contentKey, iv, plaintext)
 *
 * Why a separate `authToken`
 * --------------------------
 * The server must be able to reject a wrong password *before* it consumes the
 * note, otherwise one typo destroys the message forever. It therefore stores
 * sha256(authToken) and compares in constant time.
 *
 * Crucially `authToken` is derived from S || M, not from M alone. That means:
 *   - the server (and anyone who steals the database) cannot mount an offline
 *     password-guessing attack, because they do not have S;
 *   - `authToken` is an HKDF branch that is computationally independent of
 *     `wrappingKey`, so handing it to the server grants no ability to decrypt.
 *
 * What this design does NOT protect against (we say so plainly in the UI):
 *   - anyone who obtains the full link before the recipient does;
 *   - a compromised sender or recipient device;
 *   - malicious JavaScript served to the browser (which is true of every
 *     in-browser encryption tool, ours included).
 */

import type { Bytes } from './encoding';
import {
  base64UrlToBytes,
  bytesToBase64Url,
  bytesToUtf8,
  concatBytes,
  utf8ToBytes,
  wipe,
} from './encoding';

/** Bumped only for an incompatible change to the key schedule or wire format. */
export const CRYPTO_VERSION = 1;

const LINK_SECRET_BYTES = 32;
const CONTENT_KEY_BYTES = 32; // AES-256
const IV_BYTES = 12; // 96-bit GCM nonce, the size recommended by NIST SP 800-38D
const SALT_BYTES = 16;
const AUTH_TOKEN_BYTES = 32;

/**
 * PBKDF2 work factor for password-protected notes. High enough to make
 * guessing expensive, low enough to stay under ~1s on a mid-range phone.
 * Exceeds the OWASP 2023 recommendation of 600,000 for PBKDF2-HMAC-SHA256.
 */
export const PBKDF2_ITERATIONS = 600_000;

const HKDF_INFO_WRAP = 'shrednote:wrap:v1';
const HKDF_INFO_AUTH = 'shrednote:auth:v1';

/** The encrypted payload the browser hands to the server. Contains no key. */
export interface EncryptedPayload {
  version: number;
  ciphertext: string;
  iv: string;
  wrappedKey: string;
  wrapIv: string;
  kdfSalt: string;
  kdfIterations: number;
  /** Present only for password-protected notes. Cannot decrypt anything. */
  authToken?: string;
}

export interface EncryptResult {
  payload: EncryptedPayload;
  /** Goes in the URL fragment. MUST NOT be sent to the server or logged. */
  fragment: string;
}

export class CryptoUnsupportedError extends Error {
  constructor() {
    super('This browser does not support the Web Crypto APIs ShredNote requires.');
    this.name = 'CryptoUnsupportedError';
  }
}

export class DecryptionError extends Error {
  constructor(message = 'The note could not be decrypted.') {
    super(message);
    this.name = 'DecryptionError';
  }
}

/**
 * Returns the platform crypto object, or throws a typed error the UI can turn
 * into a friendly "your browser is too old" screen.
 */
export function getCrypto(): Crypto {
  const impl = globalThis.crypto;
  if (!impl?.subtle || typeof impl.getRandomValues !== 'function') {
    throw new CryptoUnsupportedError();
  }
  return impl;
}

export function isCryptoSupported(): boolean {
  try {
    getCrypto();
    return true;
  } catch {
    return false;
  }
}

function randomBytes(length: number): Bytes {
  const bytes = new Uint8Array(new ArrayBuffer(length));
  getCrypto().getRandomValues(bytes);
  return bytes;
}

/**
 * Derives the wrapping key and (when a password is set) the server-visible
 * auth token from the link secret and password.
 */
async function deriveKeyMaterial(
  linkSecret: Bytes,
  password: string,
  salt: Bytes,
  iterations: number,
): Promise<{ wrappingKey: CryptoKey; authToken: Bytes | null }> {
  const subtle = getCrypto().subtle;

  let passwordMaterial: Bytes = new Uint8Array(new ArrayBuffer(0));
  if (password.length > 0) {
    const passwordKey = await subtle.importKey(
      'raw',
      utf8ToBytes(password),
      'PBKDF2',
      false,
      ['deriveBits'],
    );
    passwordMaterial = new Uint8Array(
      await subtle.deriveBits(
        { name: 'PBKDF2', salt: salt, iterations, hash: 'SHA-256' },
        passwordKey,
        256,
      ),
    );
  }

  const ikm = concatBytes(linkSecret, passwordMaterial);
  const hkdfKey = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);

  const wrappingBits = await subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt,
      info: utf8ToBytes(HKDF_INFO_WRAP),
    },
    hkdfKey,
    256,
  );
  const wrappingKey = await subtle.importKey(
    'raw',
    wrappingBits,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );

  let authToken: Bytes | null = null;
  if (password.length > 0) {
    authToken = new Uint8Array(
      await subtle.deriveBits(
        {
          name: 'HKDF',
          hash: 'SHA-256',
          salt: salt,
          info: utf8ToBytes(HKDF_INFO_AUTH),
        },
        hkdfKey,
        AUTH_TOKEN_BYTES * 8,
      ),
    );
  }

  wipe(passwordMaterial);
  wipe(ikm);

  return { wrappingKey, authToken };
}

/** Encodes the link secret for the URL fragment, with a version tag. */
export function encodeFragment(linkSecret: Bytes): string {
  return `${CRYPTO_VERSION}.${bytesToBase64Url(linkSecret)}`;
}

/** Parses `1.<base64url>` back into the link secret. */
export function decodeFragment(fragment: string): { version: number; linkSecret: Bytes } {
  const raw = fragment.startsWith('#') ? fragment.slice(1) : fragment;
  const separator = raw.indexOf('.');
  if (separator === -1) {
    throw new DecryptionError('This link is missing its decryption key.');
  }
  const version = Number.parseInt(raw.slice(0, separator), 10);
  if (!Number.isInteger(version) || version < 1) {
    throw new DecryptionError('This link is missing its decryption key.');
  }
  if (version > CRYPTO_VERSION) {
    throw new DecryptionError('This link was created by a newer version of ShredNote.');
  }
  const linkSecret = base64UrlToBytes(raw.slice(separator + 1));
  if (linkSecret.length !== LINK_SECRET_BYTES) {
    throw new DecryptionError('This link is missing its decryption key.');
  }
  return { version, linkSecret };
}

/**
 * Encrypts a note in the browser.
 *
 * Returns the payload for the server (opaque ciphertext only) and the fragment
 * that must be appended to the link client-side.
 */
export async function encryptNote(plaintext: string, password = ''): Promise<EncryptResult> {
  const subtle = getCrypto().subtle;

  const linkSecret = randomBytes(LINK_SECRET_BYTES);
  const salt = randomBytes(SALT_BYTES);
  const iterations = password.length > 0 ? PBKDF2_ITERATIONS : 0;

  const { wrappingKey, authToken } = await deriveKeyMaterial(
    linkSecret,
    password,
    salt,
    iterations,
  );

  const contentKeyBytes = randomBytes(CONTENT_KEY_BYTES);
  const contentKey = await subtle.importKey(
    'raw',
    contentKeyBytes,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );

  const iv = randomBytes(IV_BYTES);
  const ciphertext = new Uint8Array(
    await subtle.encrypt(
      { name: 'AES-GCM', iv: iv, tagLength: 128 },
      contentKey,
      utf8ToBytes(plaintext),
    ),
  );

  const wrapIv = randomBytes(IV_BYTES);
  const wrappedKey = new Uint8Array(
    await subtle.encrypt(
      { name: 'AES-GCM', iv: wrapIv, tagLength: 128 },
      wrappingKey,
      contentKeyBytes,
    ),
  );

  wipe(contentKeyBytes);

  const payload: EncryptedPayload = {
    version: CRYPTO_VERSION,
    ciphertext: bytesToBase64Url(ciphertext),
    iv: bytesToBase64Url(iv),
    wrappedKey: bytesToBase64Url(wrappedKey),
    wrapIv: bytesToBase64Url(wrapIv),
    kdfSalt: bytesToBase64Url(salt),
    kdfIterations: iterations,
  };
  if (authToken) {
    payload.authToken = bytesToBase64Url(authToken);
  }

  const fragment = encodeFragment(linkSecret);
  wipe(linkSecret);

  return { payload, fragment };
}

/**
 * The ciphertext bundle returned by the server when a note is consumed.
 *
 * There is no version field here: the format version travels in the URL
 * fragment, where `decodeFragment` validates it before any of this is used.
 */
export interface SealedNote {
  ciphertext: string;
  iv: string;
  wrappedKey: string;
  wrapIv: string;
  kdfSalt: string;
  kdfIterations: number;
}

/**
 * Decrypts a consumed note in the browser.
 *
 * Any failure - wrong password, tampered ciphertext, truncated link - surfaces
 * as a DecryptionError. AES-GCM authentication means a modified ciphertext can
 * never decrypt to attacker-chosen content.
 */
export async function decryptNote(
  sealed: SealedNote,
  fragment: string,
  password = '',
): Promise<string> {
  const subtle = getCrypto().subtle;
  const { linkSecret } = decodeFragment(fragment);
  const salt = base64UrlToBytes(sealed.kdfSalt);

  const { wrappingKey } = await deriveKeyMaterial(
    linkSecret,
    password,
    salt,
    sealed.kdfIterations,
  );
  wipe(linkSecret);

  let contentKeyBytes: Bytes;
  try {
    contentKeyBytes = new Uint8Array(
      await subtle.decrypt(
        { name: 'AES-GCM', iv: base64UrlToBytes(sealed.wrapIv), tagLength: 128 },
        wrappingKey,
        base64UrlToBytes(sealed.wrappedKey),
      ),
    );
  } catch {
    throw new DecryptionError(
      password.length > 0
        ? 'That password is not correct for this note.'
        : 'This link is incomplete or has been altered.',
    );
  }

  const contentKey = await subtle.importKey(
    'raw',
    contentKeyBytes,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
  wipe(contentKeyBytes);

  try {
    const plaintextBytes = new Uint8Array(
      await subtle.decrypt(
        { name: 'AES-GCM', iv: base64UrlToBytes(sealed.iv), tagLength: 128 },
        contentKey,
        base64UrlToBytes(sealed.ciphertext),
      ),
    );
    return bytesToUtf8(plaintextBytes);
  } catch {
    throw new DecryptionError();
  }
}

/**
 * Recomputes the server-visible auth token for a password attempt.
 * Used by the recipient before the note is consumed.
 */
export async function deriveAuthToken(
  fragment: string,
  password: string,
  kdfSalt: string,
  kdfIterations: number,
): Promise<string> {
  const { linkSecret } = decodeFragment(fragment);
  const { authToken } = await deriveKeyMaterial(
    linkSecret,
    password,
    base64UrlToBytes(kdfSalt),
    kdfIterations,
  );
  wipe(linkSecret);
  if (!authToken) {
    throw new DecryptionError('This note is not password protected.');
  }
  return bytesToBase64Url(authToken);
}
