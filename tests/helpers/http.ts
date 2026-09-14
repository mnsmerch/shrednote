import { encryptNote } from '@/lib/crypto/core';
import type { ExpiryOption } from '@/lib/notes/constants';

const ORIGIN = 'http://localhost:3000';

let ipCounter = 0;

/** A fresh client IP, so each test gets its own rate-limit bucket. */
export function freshIp(): string {
  ipCounter += 1;
  return `198.51.100.${ipCounter % 250}:${ipCounter}`;
}

export function jsonRequest(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    ip?: string;
    contentType?: string | null;
    sameOrigin?: boolean;
    headers?: Record<string, string>;
  } = {},
): Request {
  const headers = new Headers(options.headers);
  if (options.contentType !== null) {
    headers.set('content-type', options.contentType ?? 'application/json');
  }
  headers.set('x-forwarded-for', options.ip ?? freshIp());
  if (options.sameOrigin !== false) {
    headers.set('sec-fetch-site', 'same-origin');
  }

  return new Request(`${ORIGIN}${path}`, {
    method: options.method ?? 'POST',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

export function params(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

export async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

/** Builds a valid create-note request body for `message`. */
export async function notePayload(
  message: string,
  options: { password?: string; expiry?: ExpiryOption; requireConfirm?: boolean; label?: string } = {},
) {
  const { payload, fragment } = await encryptNote(message, options.password ?? '');
  return {
    fragment,
    authToken: payload.authToken,
    body: {
      version: payload.version,
      ciphertext: payload.ciphertext,
      iv: payload.iv,
      wrappedKey: payload.wrappedKey,
      wrapIv: payload.wrapIv,
      kdfSalt: payload.kdfSalt,
      kdfIterations: payload.kdfIterations,
      ...(payload.authToken ? { authToken: payload.authToken } : {}),
      expiry: options.expiry ?? ('read' as ExpiryOption),
      requireConfirm: options.requireConfirm ?? true,
      ...(options.label ? { label: options.label } : {}),
    },
  };
}
