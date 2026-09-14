/**
 * GET /api/admin/stats - aggregate dashboard data.
 *
 * Requires a valid admin session. Every field comes from lib/server/analytics,
 * which is structurally unable to return note contents, keys or ids.
 */
import { cookies } from 'next/headers';

import { ADMIN_COOKIE, verifyAdminSession } from '@/lib/server/admin';
import { apiError, json, serverError } from '@/lib/server/api';
import { getAdminOverview } from '@/lib/server/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const store = await cookies();
  if (!verifyAdminSession(store.get(ADMIN_COOKIE)?.value)) {
    return apiError('unauthorized', 401, 'Sign in to view the dashboard.');
  }

  try {
    return json(await getAdminOverview());
  } catch {
    return serverError('admin.stats');
  }
}
