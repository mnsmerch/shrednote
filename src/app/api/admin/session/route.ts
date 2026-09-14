/**
 * Admin sign-in / sign-out.
 *
 * POST   { password }  -> sets a signed, httpOnly session cookie
 * DELETE               -> clears it
 *
 * The response is deliberately identical whether the password was wrong or no
 * admin password has been configured at all, so the endpoint cannot be used to
 * probe the deployment's configuration.
 */
import { cookies } from 'next/headers';

import {
  ADMIN_COOKIE,
  adminCookieOptions,
  createAdminSession,
  verifyAdminPassword,
} from '@/lib/server/admin';
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
import { log } from '@/lib/server/logging';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const rejected = requireSameOrigin(request) ?? requireJsonContentType(request);
  if (rejected) return rejected;

  const limited = await enforceRateLimit(request, 'adminLogin');
  if (limited) return limited;

  let body: unknown;
  try {
    body = await readJsonBody(request, 2_048);
  } catch (error) {
    if (error instanceof PayloadTooLargeError || error instanceof MalformedJsonError) {
      return apiError('invalid_request', 400, 'That request could not be read.');
    }
    return serverError('admin.session');
  }

  const password =
    typeof body === 'object' && body !== null && 'password' in body
      ? (body as { password: unknown }).password
      : undefined;

  if (typeof password !== 'string' || password.length === 0 || password.length > 512) {
    return apiError('unauthorized', 401, 'Incorrect password.');
  }

  try {
    if (!verifyAdminPassword(password)) {
      log.warn({ event: 'admin_login_failed' });
      return apiError('unauthorized', 401, 'Incorrect password.');
    }
  } catch {
    return serverError('admin.session');
  }

  const session = createAdminSession();
  const store = await cookies();
  store.set(ADMIN_COOKIE, session.token, adminCookieOptions(session.maxAge));

  log.info({ event: 'admin_login_succeeded' });
  return json({ ok: true });
}

export async function DELETE(request: Request): Promise<Response> {
  const rejected = requireSameOrigin(request);
  if (rejected) return rejected;

  const store = await cookies();
  store.set(ADMIN_COOKIE, '', adminCookieOptions(0));
  return json({ ok: true });
}
