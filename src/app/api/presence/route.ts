/**
 * POST /api/presence - "a visitor is on the site" heartbeat.
 *
 * The request has no body and the response has none. Everything recorded is
 * derived on the server from the connection itself; see lib/server/presence
 * for exactly what is kept and for how long.
 *
 * There is no separate rate limit: a client maps to one row however often it
 * calls, so repeating the request cannot inflate the numbers or grow the
 * table, and a limiter would cost a second database write per heartbeat.
 */
import { requireSameOrigin } from '@/lib/server/api';
import { touchPresence } from '@/lib/server/presence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const rejected = requireSameOrigin(request);
  if (rejected) return rejected;

  await touchPresence(request);

  return new Response(null, {
    status: 204,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
