/**
 * GET /api/admin/live - who is on the site right now.
 *
 * Requires a valid admin session. Returns counts grouped by place; the
 * underlying rows and their digests never leave lib/server/presence.
 */
import { cookies } from 'next/headers';

import { ADMIN_COOKIE, verifyAdminSession } from '@/lib/server/admin';
import { apiError, json, serverError } from '@/lib/server/api';
import { getLiveVisitors } from '@/lib/server/presence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const store = await cookies();
  if (!verifyAdminSession(store.get(ADMIN_COOKIE)?.value)) {
    return apiError('unauthorized', 401, 'Sign in to view the dashboard.');
  }

  try {
    return json(await getLiveVisitors());
  } catch {
    return serverError('admin.live');
  }
}
