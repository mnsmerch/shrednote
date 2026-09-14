/**
 * POST /api/notes - store an encrypted note.
 *
 * The body that reaches this handler is opaque ciphertext produced by the
 * sender's browser. There is no code path here, or anywhere downstream, that
 * receives a plaintext message, an encryption key or a password. The URL
 * fragment holding the key is added on the client after this call returns and
 * is never transmitted.
 */
import {
  MalformedJsonError,
  PayloadTooLargeError,
  apiError,
  enforceRateLimit,
  json,
  readJsonBody,
  requireJsonContentType,
  requireSameOrigin,
  serverError,
} from '@/lib/server/api';
import { MAX_CIPHERTEXT_LENGTH } from '@/lib/notes/constants';
import { createNote } from '@/lib/notes/service';
import { createNoteSchema } from '@/lib/notes/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Ciphertext plus a little slack for the surrounding JSON. */
const MAX_BODY_BYTES = MAX_CIPHERTEXT_LENGTH + 4_096;

export async function POST(request: Request): Promise<Response> {
  const rejected = requireSameOrigin(request) ?? requireJsonContentType(request);
  if (rejected) return rejected;

  const limited = await enforceRateLimit(request, 'create');
  if (limited) return limited;

  let body: unknown;
  try {
    body = await readJsonBody(request, MAX_BODY_BYTES);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return apiError('invalid_request', 413, 'That note is too large to send.');
    }
    if (error instanceof MalformedJsonError) {
      return apiError('invalid_request', 400, 'That request could not be read.');
    }
    return serverError('notes.create');
  }

  const parsed = createNoteSchema.safeParse(body);
  if (!parsed.success) {
    // Validation detail is intentionally withheld: it would describe our
    // internal shape to anyone probing the endpoint.
    return apiError('invalid_request', 400, 'That note could not be created.');
  }

  try {
    const note = await createNote({
      ciphertext: parsed.data.ciphertext,
      iv: parsed.data.iv,
      wrappedKey: parsed.data.wrappedKey,
      wrapIv: parsed.data.wrapIv,
      kdfSalt: parsed.data.kdfSalt,
      kdfIterations: parsed.data.kdfIterations,
      authToken: parsed.data.authToken,
      expiry: parsed.data.expiry,
      requireConfirm: parsed.data.requireConfirm,
      label: parsed.data.label,
    });

    return json({ id: note.id, expiresAt: note.expiresAt.toISOString() }, { status: 201 });
  } catch {
    return serverError('notes.create');
  }
}
