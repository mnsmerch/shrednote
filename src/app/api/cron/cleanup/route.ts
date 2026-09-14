/**
 * Scheduled cleanup: deletes expired notes, removes old tombstones and scrubs
 * any consumed row that still holds ciphertext.
 *
 * Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`. The same
 * header works for any other scheduler. Without CRON_SECRET configured the
 * endpoint refuses to run rather than defaulting to open.
 */
import { timingSafeEqual } from 'node:crypto';

import { apiError, json, serverError } from '@/lib/server/api';
import { cronSecret } from '@/lib/server/env';
import { cleanupNotes } from '@/lib/notes/service';
import { pruneRateLimits } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(request: Request): boolean {
  const configured = cronSecret();
  if (!configured) return false;

  const header = request.headers.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(configured, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return apiError('unauthorized', 401, 'Not authorized.');
  }

  try {
    const notes = await cleanupNotes();
    const rateLimits = await pruneRateLimits();
    return json({ ...notes, rateLimitsPruned: rateLimits });
  } catch {
    return serverError('cron.cleanup');
  }
}

export const GET = handle;
export const POST = handle;
