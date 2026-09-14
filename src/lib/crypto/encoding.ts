/**
 * Binary <-> text helpers used by the ShredNote crypto layer.
 *
 * base64url (RFC 4648 §5) is used everywhere because the values travel in URL
 * fragments and JSON bodies; the standard alphabet's `+`, `/` and `=` would
 * need escaping and would make links uglier and easier to corrupt when copied.
 */

/**
 * A Uint8Array explicitly backed by a (non-shared) ArrayBuffer, which is what
 * every Web Crypto `BufferSource` parameter requires.
 */
export type Bytes = Uint8Array<ArrayBuffer>;

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  // Chunked to avoid blowing the argument limit on large ciphertexts.
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToBytes(value: string): Bytes {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) {
    throw new Error('Malformed base64url input');
  }
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function utf8ToBytes(value: string): Bytes {
  return new TextEncoder().encode(value) as Bytes;
}

export function bytesToUtf8(bytes: Uint8Array): string {
  // `fatal` makes a wrong key surface as a decode error instead of mojibake.
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

/** Concatenates byte arrays into a single buffer. */
export function concatBytes(...parts: Uint8Array[]): Bytes {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(new ArrayBuffer(total));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/**
 * Best-effort overwrite of a buffer that held key material.
 *
 * JavaScript gives no guarantee that this is the only copy (the engine may
 * have moved it), so this is defence in depth, not a guarantee. We never
 * advertise it as one.
 */
export function wipe(bytes: Uint8Array): void {
  bytes.fill(0);
}
