import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { GET as describeRoute } from '@/app/api/notes/[id]/route';
import { POST as consumeRoute } from '@/app/api/notes/[id]/consume/route';
import { POST as createRoute } from '@/app/api/notes/route';
import { decryptNote } from '@/lib/crypto/core';
import { MAX_CIPHERTEXT_LENGTH, MAX_PASSWORD_ATTEMPTS } from '@/lib/notes/constants';
import { RATE_LIMITS } from '@/lib/server/rate-limit';

import { prisma, resetDatabase } from '../helpers/db';
import { freshIp, jsonRequest, notePayload, params, readJson } from '../helpers/http';

interface CreateResponse {
  id: string;
  expiresAt: string;
}
interface ErrorResponse {
  error: { code: string; message: string; attemptsRemaining?: number };
}

async function createNoteVia(
  body: unknown,
  options: { ip?: string } = {},
): Promise<Response> {
  return createRoute(jsonRequest('/api/notes', { body, ip: options.ip }));
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/notes', () => {
  it('creates a note and returns only an id and an expiry', async () => {
    const { body } = await notePayload('hello there');
    const response = await createNoteVia(body);

    expect(response.status).toBe(201);
    const data = await readJson<CreateResponse>(response);
    expect(Object.keys(data).sort()).toEqual(['expiresAt', 'id']);
    expect(data.id).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it('never allows a cache to store the response', async () => {
    const { body } = await notePayload('hello');
    const response = await createNoteVia(body);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('x-robots-tag')).toContain('noindex');
  });

  it('rejects cross-site requests (CSRF)', async () => {
    const { body } = await notePayload('hello');
    const response = await createRoute(
      jsonRequest('/api/notes', { body, sameOrigin: false, headers: { origin: 'https://evil.test' } }),
    );
    expect(response.status).toBe(403);
    expect((await readJson<ErrorResponse>(response)).error.code).toBe('forbidden');
  });

  it('rejects non-JSON content types', async () => {
    const { body } = await notePayload('hello');
    const response = await createRoute(
      jsonRequest('/api/notes', { body, contentType: 'application/x-www-form-urlencoded' }),
    );
    expect(response.status).toBe(415);
  });

  it('rejects unknown fields rather than silently ignoring them', async () => {
    const { body } = await notePayload('hello');
    const response = await createNoteVia({ ...body, plaintext: 'oops', isAdmin: true });
    expect(response.status).toBe(400);
    expect(await prisma.note.count()).toBe(0);
  });

  it('rejects non-base64url ciphertext, which blocks injection payloads', async () => {
    const { body } = await notePayload('hello');
    for (const malicious of [
      "'; DROP TABLE notes; --",
      '<script>alert(1)</script>',
      '../../etc/passwd',
      '\u0000nullbyte',
    ]) {
      const response = await createNoteVia({ ...body, ciphertext: malicious });
      expect(response.status).toBe(400);
    }
    expect(await prisma.note.count()).toBe(0);
  });

  it('rejects a ciphertext larger than the limit', async () => {
    const { body } = await notePayload('hello');
    const response = await createNoteVia({
      ...body,
      ciphertext: 'A'.repeat(MAX_CIPHERTEXT_LENGTH + 1),
    });
    expect([400, 413]).toContain(response.status);
    expect(await prisma.note.count()).toBe(0);
  });

  it('accepts a large but legal note', async () => {
    const { body } = await notePayload('A'.repeat(25_000));
    const response = await createNoteVia(body);
    expect(response.status).toBe(201);
  });

  it('refuses a password-protected note that weakens its own key derivation', async () => {
    const { body } = await notePayload('secret', { password: 'pw' });
    const response = await createNoteVia({ ...body, kdfIterations: 1 });
    expect(response.status).toBe(400);
  });

  it('strips control characters from the reference label', async () => {
    const { body } = await notePayload('hello', { label: 'Server\u0000 login\u001b[31m' });
    const response = await createNoteVia(body);
    expect(response.status).toBe(201);

    const { id } = await readJson<CreateResponse>(response);
    const row = await prisma.note.findUniqueOrThrow({ where: { id } });
    expect(row.label).toBe('Server login[31m');
  });

  it('stores a script-like label verbatim for React to escape, never as markup', async () => {
    const { body } = await notePayload('hello', { label: '<img src=x onerror=alert(1)>' });
    const { id } = await readJson<CreateResponse>(await createNoteVia(body));

    const describe = await describeRoute(jsonRequest(`/api/notes/${id}`, { method: 'GET' }), params(id));
    const data = await readJson<{ label: string }>(describe);
    // The API returns it as a JSON string value; nothing here interprets it as
    // HTML, and the reader renders it as a React text child.
    expect(data.label).toBe('<img src=x onerror=alert(1)>');
    expect(describe.headers.get('content-type')).toContain('application/json');
  });

  it('rate limits note creation per client', async () => {
    const ip = freshIp();
    const { body } = await notePayload('hello');

    for (let attempt = 0; attempt < RATE_LIMITS.create.limit; attempt += 1) {
      const response = await createNoteVia(body, { ip });
      expect(response.status).toBe(201);
    }

    const blocked = await createNoteVia(body, { ip });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBeTruthy();
    expect((await readJson<ErrorResponse>(blocked)).error.code).toBe('rate_limited');

    // A different client is unaffected.
    const other = await createNoteVia(body, { ip: freshIp() });
    expect(other.status).toBe(201);
  });
});

describe('GET /api/notes/:id', () => {
  it('describes a note without consuming it and without returning ciphertext', async () => {
    const { body } = await notePayload('still here', { label: 'WiFi password' });
    const { id } = await readJson<CreateResponse>(await createNoteVia(body));

    const response = await describeRoute(
      jsonRequest(`/api/notes/${id}`, { method: 'GET' }),
      params(id),
    );
    expect(response.status).toBe(200);

    const data = await readJson<Record<string, unknown>>(response);
    expect(Object.keys(data).sort()).toEqual([
      'expiresAt',
      'id',
      'kdfIterations',
      'kdfSalt',
      'label',
      'passwordProtected',
      'requireConfirm',
    ]);
    expect(JSON.stringify(data)).not.toContain(body.ciphertext);

    const row = await prisma.note.findUniqueOrThrow({ where: { id } });
    expect(row.consumedAt).toBeNull();
  });

  it('answers identically for unknown, malformed, consumed and expired ids', async () => {
    const { body } = await notePayload('gone soon');
    const { id } = await readJson<CreateResponse>(await createNoteVia(body));
    await consumeRoute(jsonRequest(`/api/notes/${id}/consume`, { body: {} }), params(id));

    const cases = [id, 'AAAAAAAAAAAAAAAAAAAAAA', 'too-short', '../../../etc/passwd', ''];
    const bodies = new Set<string>();

    for (const candidate of cases) {
      const response = await describeRoute(
        jsonRequest(`/api/notes/${candidate}`, { method: 'GET' }),
        params(candidate),
      );
      expect(response.status).toBe(404);
      bodies.add(await response.text());
    }

    // One single response body for every "not available" case: the endpoint
    // cannot be used to learn whether an id ever existed.
    expect(bodies.size).toBe(1);
  });

  it('rate limits lookups, which is what stops bulk id probing', async () => {
    const ip = freshIp();
    for (let attempt = 0; attempt < RATE_LIMITS.lookup.limit; attempt += 1) {
      const response = await describeRoute(
        jsonRequest('/api/notes/AAAAAAAAAAAAAAAAAAAAAA', { method: 'GET', ip }),
        params('AAAAAAAAAAAAAAAAAAAAAA'),
      );
      expect(response.status).toBe(404);
    }

    const blocked = await describeRoute(
      jsonRequest('/api/notes/AAAAAAAAAAAAAAAAAAAAAA', { method: 'GET', ip }),
      params('AAAAAAAAAAAAAAAAAAAAAA'),
    );
    expect(blocked.status).toBe(429);
  });
});

describe('POST /api/notes/:id/consume', () => {
  it('returns ciphertext that decrypts with the fragment, exactly once', async () => {
    const message = 'the eagle has landed';
    const { body, fragment } = await notePayload(message);
    const { id } = await readJson<CreateResponse>(await createNoteVia(body));

    const response = await consumeRoute(
      jsonRequest(`/api/notes/${id}/consume`, { body: {} }),
      params(id),
    );
    expect(response.status).toBe(200);

    const data = await readJson<{ note: Record<string, string | number> }>(response);
    await expect(
      decryptNote(data.note as never, fragment),
    ).resolves.toBe(message);

    const second = await consumeRoute(
      jsonRequest(`/api/notes/${id}/consume`, { body: {} }),
      params(id),
    );
    expect(second.status).toBe(404);
  });

  it('gives the note to exactly one of many simultaneous requests', async () => {
    const { body } = await notePayload('contested');
    const { id } = await readJson<CreateResponse>(await createNoteVia(body));

    const responses = await Promise.all(
      Array.from({ length: 25 }, () =>
        consumeRoute(jsonRequest(`/api/notes/${id}/consume`, { body: {} }), params(id)),
      ),
    );

    expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 404)).toHaveLength(24);
  });

  it('rejects cross-site consume attempts', async () => {
    const { body } = await notePayload('secret');
    const { id } = await readJson<CreateResponse>(await createNoteVia(body));

    const response = await consumeRoute(
      jsonRequest(`/api/notes/${id}/consume`, {
        body: {},
        sameOrigin: false,
        headers: { origin: 'https://evil.test' },
      }),
      params(id),
    );
    expect(response.status).toBe(403);

    const row = await prisma.note.findUniqueOrThrow({ where: { id } });
    expect(row.consumedAt).toBeNull();
  });

  it('asks for a password and survives a wrong one', async () => {
    const message = 'vault code 1234';
    const { body, authToken } = await notePayload(message, { password: 'correct-password' });
    const { id } = await readJson<CreateResponse>(await createNoteVia(body));

    const missing = await consumeRoute(
      jsonRequest(`/api/notes/${id}/consume`, { body: {} }),
      params(id),
    );
    expect(missing.status).toBe(401);
    expect((await readJson<ErrorResponse>(missing)).error.code).toBe('password_required');

    const wrong = await consumeRoute(
      jsonRequest(`/api/notes/${id}/consume`, { body: { authToken: 'A'.repeat(43) } }),
      params(id),
    );
    expect(wrong.status).toBe(401);
    const wrongBody = await readJson<ErrorResponse>(wrong);
    expect(wrongBody.error.code).toBe('invalid_password');
    expect(wrongBody.error.attemptsRemaining).toBe(MAX_PASSWORD_ATTEMPTS - 1);

    const correct = await consumeRoute(
      jsonRequest(`/api/notes/${id}/consume`, { body: { authToken } }),
      params(id),
    );
    expect(correct.status).toBe(200);
  });

  it('destroys a note after the attempt limit and never returns it afterwards', async () => {
    const { body, authToken } = await notePayload('secret', { password: 'correct-password' });
    const { id } = await readJson<CreateResponse>(await createNoteVia(body));
    const ip = freshIp();

    for (let attempt = 1; attempt < MAX_PASSWORD_ATTEMPTS; attempt += 1) {
      const response = await consumeRoute(
        jsonRequest(`/api/notes/${id}/consume`, { body: { authToken: 'B'.repeat(43) }, ip }),
        params(id),
      );
      expect(response.status).toBe(401);
    }

    const final = await consumeRoute(
      jsonRequest(`/api/notes/${id}/consume`, { body: { authToken: 'B'.repeat(43) }, ip }),
      params(id),
    );
    expect(final.status).toBe(410);
    expect((await readJson<ErrorResponse>(final)).error.code).toBe('note_destroyed');

    const withCorrect = await consumeRoute(
      jsonRequest(`/api/notes/${id}/consume`, { body: { authToken } }),
      params(id),
    );
    expect(withCorrect.status).toBe(404);
  });

  it('rate limits password attempts independently', async () => {
    const ip = freshIp();
    const { body } = await notePayload('secret', { password: 'pw' });

    // Spread attempts across fresh notes so the per-note cap is not what stops us.
    for (let attempt = 0; attempt < RATE_LIMITS.password.limit; attempt += 1) {
      const { id } = await readJson<CreateResponse>(await createNoteVia(body));
      const response = await consumeRoute(
        jsonRequest(`/api/notes/${id}/consume`, { body: { authToken: 'C'.repeat(43) }, ip }),
        params(id),
      );
      expect(response.status).toBe(401);
    }

    const { id } = await readJson<CreateResponse>(await createNoteVia(body));
    const blocked = await consumeRoute(
      jsonRequest(`/api/notes/${id}/consume`, { body: { authToken: 'C'.repeat(43) }, ip }),
      params(id),
    );
    expect(blocked.status).toBe(429);
  });

  it('rejects malformed and oversized request bodies', async () => {
    const { body } = await notePayload('secret');
    const { id } = await readJson<CreateResponse>(await createNoteVia(body));

    const bad = await consumeRoute(
      jsonRequest(`/api/notes/${id}/consume`, { body: { authToken: '<script>' } }),
      params(id),
    );
    expect(bad.status).toBe(400);

    const huge = await consumeRoute(
      jsonRequest(`/api/notes/${id}/consume`, { body: { authToken: 'A'.repeat(50_000) } }),
      params(id),
    );
    expect(huge.status).toBe(400);

    // Still readable: neither invalid request consumed it.
    const ok = await consumeRoute(
      jsonRequest(`/api/notes/${id}/consume`, { body: {} }),
      params(id),
    );
    expect(ok.status).toBe(200);
  });
});
