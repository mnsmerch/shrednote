/**
 * Note identifiers.
 *
 * 16 bytes (128 bits) from a CSPRNG, base64url encoded to 22 characters.
 * At a sustained one million guesses per second it would take on the order of
 * 10^25 years to find a single live note, which is why enumeration is not a
 * practical attack. Rate limiting on the read endpoints handles the rest.
 */
import { randomBytes } from 'node:crypto';

const ID_BYTES = 16;
export const NOTE_ID_LENGTH = 22;
const NOTE_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;

export function generateNoteId(): string {
  return randomBytes(ID_BYTES).toString('base64url');
}

export function isValidNoteId(value: unknown): value is string {
  return typeof value === 'string' && NOTE_ID_PATTERN.test(value);
}
