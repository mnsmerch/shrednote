/**
 * Browser -> ShredNote API client.
 *
 * SECURITY: every request body sent from here is assembled from the encrypted
 * payload only. The URL fragment (the decryption key) is never read into a
 * request, and `fetch` does not transmit fragments in any case. Keep it that
 * way: nothing in this file may accept a plaintext message, a password or a
 * fragment as a parameter that ends up in a body or query string.
 */
import type { EncryptedPayload } from '@/lib/crypto/core';
import type { ExpiryOption } from '@/lib/notes/constants';

export interface ApiFailure {
  code: string;
  message: string;
  attemptsRemaining?: number;
  retryAfter?: number;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly attemptsRemaining?: number;
  readonly retryAfter?: number;

  constructor(status: number, failure: ApiFailure) {
    super(failure.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = failure.code;
    this.attemptsRemaining = failure.attemptsRemaining;
    this.retryAfter = failure.retryAfter;
  }
}

const NETWORK_MESSAGE =
  'We could not reach ShredNote. Check your connection and try again.';

async function request<T>(input: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init.headers },
      // Never let a note request be served from a cache.
      cache: 'no-store',
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError(0, { code: 'network_error', message: NETWORK_MESSAGE });
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const failure =
      body && typeof body === 'object' && 'error' in body
        ? ((body as { error: ApiFailure }).error ?? null)
        : null;
    throw new ApiError(response.status, {
      code: failure?.code ?? 'server_error',
      message: failure?.message ?? 'Something went wrong. Please try again.',
      attemptsRemaining: failure?.attemptsRemaining,
      retryAfter: failure?.retryAfter,
    });
  }

  return body as T;
}

export interface CreateNoteOptions {
  expiry: ExpiryOption;
  requireConfirm: boolean;
  label?: string;
}

export async function createNoteRequest(
  payload: EncryptedPayload,
  options: CreateNoteOptions,
): Promise<{ id: string; expiresAt: string }> {
  return request('/api/notes', {
    method: 'POST',
    body: JSON.stringify({
      version: payload.version,
      ciphertext: payload.ciphertext,
      iv: payload.iv,
      wrappedKey: payload.wrappedKey,
      wrapIv: payload.wrapIv,
      kdfSalt: payload.kdfSalt,
      kdfIterations: payload.kdfIterations,
      authToken: payload.authToken,
      expiry: options.expiry,
      requireConfirm: options.requireConfirm,
      label: options.label && options.label.length > 0 ? options.label : undefined,
    }),
  });
}

export interface NoteDescriptionResponse {
  id: string;
  passwordProtected: boolean;
  requireConfirm: boolean;
  label: string | null;
  expiresAt: string;
  kdfSalt: string;
  kdfIterations: number;
}

export async function describeNoteRequest(id: string): Promise<NoteDescriptionResponse> {
  return request(`/api/notes/${encodeURIComponent(id)}`, { method: 'GET' });
}

export interface SealedNoteResponse {
  note: {
    ciphertext: string;
    iv: string;
    wrappedKey: string;
    wrapIv: string;
    kdfSalt: string;
    kdfIterations: number;
  };
}

/**
 * Consumes the note. This is irreversible: by the time the promise resolves
 * the server no longer holds the ciphertext.
 */
export async function consumeNoteRequest(
  id: string,
  authToken?: string,
): Promise<SealedNoteResponse> {
  return request(`/api/notes/${encodeURIComponent(id)}/consume`, {
    method: 'POST',
    body: JSON.stringify(authToken ? { authToken } : {}),
  });
}
