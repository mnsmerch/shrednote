'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

const HEARTBEAT_MS = 45_000;

/** Pages that never report presence. */
function isExcluded(pathname: string): boolean {
  // Note reading pages stay silent so that opening a note leaves no trace
  // beyond the note itself. The admin area is the owner, not a visitor.
  return pathname.startsWith('/n/') || pathname.startsWith('/admin');
}

function optedOut(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true || nav.doNotTrack === '1';
}

/**
 * Tells the server "someone is here" while a page is open and visible.
 *
 * The request carries no body, no cookie and no page address. The server
 * derives a coarse location from the connection and keeps it for minutes; see
 * lib/server/presence. Visitors who send Global Privacy Control or Do Not
 * Track are not counted at all.
 */
export function PresenceBeacon() {
  const pathname = usePathname();
  const excluded = isExcluded(pathname);

  useEffect(() => {
    if (excluded || optedOut()) return;

    const beat = () => {
      if (document.visibilityState !== 'visible') return;
      void fetch('/api/presence', {
        method: 'POST',
        credentials: 'omit',
        cache: 'no-store',
        keepalive: true,
      }).catch(() => {
        // Presence is best effort; a failed heartbeat is not worth surfacing.
      });
    };

    beat();
    const interval = setInterval(beat, HEARTBEAT_MS);
    document.addEventListener('visibilitychange', beat);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', beat);
    };
  }, [excluded]);

  return null;
}
