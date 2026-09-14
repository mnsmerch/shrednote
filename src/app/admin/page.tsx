import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { AdminLogin } from '@/components/admin/AdminLogin';
import { ADMIN_COOKIE, isAdminConfigured, verifyAdminSession } from '@/lib/server/admin';
import { getAdminOverview } from '@/lib/server/analytics';

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = 'force-dynamic';

/**
 * The operator dashboard.
 *
 * Authentication is checked here on the server, and again inside
 * /api/admin/stats - the page rendering is a convenience, the API check is the
 * control. The dashboard shows aggregate counters only; there is no code path
 * from here to a note's contents.
 *
 * The first snapshot is read on the server so the dashboard renders populated
 * rather than loading; the client then refreshes it on an interval.
 */
export default async function AdminPage() {
  const store = await cookies();
  const authenticated = verifyAdminSession(store.get(ADMIN_COOKIE)?.value);

  return (
    <div className="mx-auto max-w-5xl px-5 py-12 sm:px-6 sm:py-16">
      {authenticated ? (
        <AdminDashboard initial={await getAdminOverview()} />
      ) : (
        <AdminLogin configured={isAdminConfigured()} />
      )}
    </div>
  );
}
