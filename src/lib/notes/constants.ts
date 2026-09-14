/**
 * Product limits. Shared by the browser (for instant validation) and the
 * server (which enforces them for real - client checks are a convenience,
 * never a control).
 */

/** Longest plaintext a free note may contain. */
export const MAX_MESSAGE_LENGTH = 25_000;

/**
 * Ciphertext is base64url of (plaintext bytes + 16 byte GCM tag), so it grows
 * by roughly 4/3. This bound is deliberately generous but finite so a single
 * request cannot fill the database.
 */
export const MAX_CIPHERTEXT_LENGTH = 200_000;

/** The non-sensitive reference label shown to the recipient. */
export const MAX_LABEL_LENGTH = 60;

/**
 * Minimum PBKDF2 work factor the server accepts for a password-protected
 * note. A client that tried to weaken its own key derivation is rejected.
 * Mirrors PBKDF2_ITERATIONS in lib/crypto/core.ts.
 */
export const PBKDF2_MINIMUM_ITERATIONS = 600_000;

export const MIN_PASSWORD_LENGTH = 4;
export const MAX_PASSWORD_LENGTH = 256;

/**
 * Wrong-password attempts before a note destroys itself. Stops a password
 * from being ground down by anyone who obtained the link, and is low enough
 * that no honest recipient will hit it.
 */
export const MAX_PASSWORD_ATTEMPTS = 10;

export type ExpiryOption = 'read' | '1h' | '24h' | '7d' | '30d';

export const EXPIRY_OPTIONS: ReadonlyArray<{
  value: ExpiryOption;
  label: string;
  hint: string;
  seconds: number;
}> = [
  {
    value: 'read',
    label: 'Destroy after reading',
    hint: 'Link stays valid for up to 30 days if nobody opens it.',
    seconds: 60 * 60 * 24 * 30,
  },
  { value: '1h', label: '1 hour', hint: 'Also destroyed as soon as it is read.', seconds: 60 * 60 },
  {
    value: '24h',
    label: '24 hours',
    hint: 'Also destroyed as soon as it is read.',
    seconds: 60 * 60 * 24,
  },
  {
    value: '7d',
    label: '7 days',
    hint: 'Also destroyed as soon as it is read.',
    seconds: 60 * 60 * 24 * 7,
  },
  {
    value: '30d',
    label: '30 days',
    hint: 'Also destroyed as soon as it is read.',
    seconds: 60 * 60 * 24 * 30,
  },
];

export const DEFAULT_EXPIRY: ExpiryOption = 'read';

/** Hard ceiling on how long any note may live, whatever the client asks for. */
export const MAX_TTL_SECONDS = 60 * 60 * 24 * 30;

export function ttlSecondsFor(option: ExpiryOption): number {
  const match = EXPIRY_OPTIONS.find((entry) => entry.value === option);
  return Math.min(match?.seconds ?? MAX_TTL_SECONDS, MAX_TTL_SECONDS);
}
