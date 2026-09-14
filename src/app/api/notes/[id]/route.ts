/**
 * GET /api/notes/:id - describe a note without consuming it.
 *
 * Returns only what the recipient's browser needs before opening the note:
 * whether a password is required, whether to confirm before revealing, the
 * sender's non-sensitive reference label, and the PBKDF2 salt and iteration
 * count used to derive the password proof. It never returns ciphertext, and
 * the KDF parameters are worthless without the link fragment.
 *
 * SECURITY: unknown, consumed and expired ids all produce the identical 404
 * body, so this endpoint cannot be used to prove that a note ever existed.
 */
import { apiError, enforceRateLimit, json, serverError } from '@/lib/server/api';
import { isValidNoteId } from '@/lib/server/ids';
import { describeNote } from '@/lib/notes/service';
import { bump } from '@/lib/server/stats';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GONE = () =>
  apiError('note_gone', 404, 'This ShredNote is gone. It may have already been opened or expired.');

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const limited = await enforceRateLimit(request, 'lookup');
  if (limited) return limited;

  const { id } = await context.params;
  // A malformed id is answered exactly like a missing one.
  if (!isValidNoteId(id)) return GONE();

  try {
    const note = await describeNote(id);
    if (!note) return GONE();

    void bump('noteLinkVisits');

    return json({
      id: note.id,
      passwordProtected: note.passwordProtected,
      requireConfirm: note.requireConfirm,
      label: note.label,
      expiresAt: note.expiresAt.toISOString(),
      kdfSalt: note.kdfSalt,
      kdfIterations: note.kdfIterations,
    });
  } catch {
    return serverError('notes.describe');
  }
}
