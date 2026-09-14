/**
 * POST /api/notes/:id/consume - read a note exactly once.
 *
 * The note is claimed and scrubbed in a single atomic UPDATE before this
 * handler returns (see lib/notes/service.ts). Two simultaneous requests can
 * never both succeed, and a successful response is the last time the
 * ciphertext exists anywhere on our side.
 *
 * The response is ciphertext. Decryption happens in the recipient's browser
 * with the key from the URL fragment, which never reached us.
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
import { isValidNoteId } from '@/lib/server/ids';
import { consumeNote } from '@/lib/notes/service';
import { consumeNoteSchema } from '@/lib/notes/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 2_048;

const GONE = () =>
  apiError('note_gone', 404, 'This ShredNote is gone. It may have already been opened or expired.');

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const rejected = requireSameOrigin(request) ?? requireJsonContentType(request);
  if (rejected) return rejected;

  const limited = await enforceRateLimit(request, 'consume');
  if (limited) return limited;

  const { id } = await context.params;
  if (!isValidNoteId(id)) return GONE();

  let body: unknown;
  try {
    body = await readJsonBody(request, MAX_BODY_BYTES);
  } catch (error) {
    if (error instanceof PayloadTooLargeError || error instanceof MalformedJsonError) {
      return apiError('invalid_request', 400, 'That request could not be read.');
    }
    return serverError('notes.consume');
  }

  const parsed = consumeNoteSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return apiError('invalid_request', 400, 'That request could not be read.');
  }

  // A password attempt gets its own, tighter budget on top of the read budget.
  if (parsed.data.authToken) {
    const passwordLimited = await enforceRateLimit(request, 'password');
    if (passwordLimited) return passwordLimited;
  }

  try {
    const result = await consumeNote(id, parsed.data.authToken);

    switch (result.status) {
      case 'ok':
        return json({ note: result.note });

      case 'password_required':
        return apiError('password_required', 401, 'This note is protected by a password.');

      case 'invalid_password':
        return apiError(
          'invalid_password',
          401,
          'That password is not correct.',
          { attemptsRemaining: result.attemptsRemaining },
        );

      case 'destroyed':
        return apiError(
          'note_destroyed',
          410,
          'Too many incorrect passwords. This note has been destroyed.',
        );

      case 'gone':
      default:
        return GONE();
    }
  } catch {
    return serverError('notes.consume');
  }
}
