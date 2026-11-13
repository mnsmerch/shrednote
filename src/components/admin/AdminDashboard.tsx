'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import type { AdminOverview } from '@/lib/server/analytics';
import type { LiveVisitors } from '@/lib/server/presence';

import { flag, placeName } from './places';
import { VisitorGlobe } from './VisitorGlobe';

const LIVE_REFRESH_MS = 10_000;
const OVERVIEW_REFRESH_MS = 60_000;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

function Stat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'warning';
}) {
  return (
    <div className="sn-card p-5">
      <p className="text-[0.8125rem] font-medium text-muted">{label}</p>
      <p
        className={`mt-1.5 text-[1.75rem] font-semibold tracking-[-0.03em] tabular-nums ${
          tone === 'warning' ? 'text-warning' : 'text-ink'
        }`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-[0.8125rem] text-faint">{hint}</p> : null}
    </div>
  );
}

/** Compact 30-day bar chart, drawn with divs - no charting dependency. */
function DailyChart({ data }: { data: AdminOverview['daily'] }) {
  const peak = Math.max(1, ...data.map((point) => Math.max(point.created, point.consumed)));

  return (
    <div className="sn-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[1.0625rem] font-semibold text-ink">Notes per day</h2>
        <div className="flex gap-4 text-[0.8125rem] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-accent" aria-hidden="true" /> Created
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-positive" aria-hidden="true" /> Read
          </span>
        </div>
      </div>

      <div className="mt-5 flex h-40 items-end gap-[3px]" role="img" aria-label="Notes created and read per day over the last 30 days">
        {data.map((point) => (
          <div key={point.day} className="group relative flex h-full flex-1 items-end gap-[2px]">
            <div
              className="w-1/2 rounded-t-sm bg-accent transition-opacity group-hover:opacity-80"
              style={{ height: `${Math.max(2, (point.created / peak) * 100)}%` }}
            />
            <div
              className="w-1/2 rounded-t-sm bg-positive transition-opacity group-hover:opacity-80"
              style={{ height: `${Math.max(2, (point.consumed / peak) * 100)}%` }}
            />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-lg bg-ink px-2 py-1 text-[0.75rem] whitespace-nowrap text-canvas group-hover:block">
              {point.day}: {point.created} created, {point.consumed} read
            </span>
          </div>
        ))}
      </div>

      <div className="mt-2 flex justify-between text-[0.75rem] text-faint">
        <span>{data[0]?.day}</span>
        <span>{data[data.length - 1]?.day}</span>
      </div>
    </div>
  );
}

/**
 * Who is on the site right now. Deliberately dark in both themes: the globe
 * is drawn as a lit sphere and reads badly on a pale card.
 */
function LivePanel({ live }: { live: LiveVisitors }) {
  // The globe plots each coarse coordinate; the list reads better by region.
  const byRegion = new Map<string, { country: string; region: string; count: number }>();
  for (const place of live.places) {
    const key = `${place.country}-${place.region}`;
    const entry = byRegion.get(key);
    if (entry) entry.count += place.count;
    else byRegion.set(key, { country: place.country, region: place.region, count: place.count });
  }
  const regions = [...byRegion.values()].sort((a, b) => b.count - a.count);
  const top = regions.slice(0, 8);
  const more = regions.length - top.length;

  return (
    <section
      aria-labelledby="live-now"
      className="overflow-hidden rounded-[1.25rem] border border-[#242a33] bg-[#0b0d10] text-[#f2f4f7] shadow-[0_18px_40px_-20px_rgb(0_0_0/0.6)]"
    >
      <div className="grid items-center gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="p-6 sm:p-8">
          <h2
            id="live-now"
            className="flex items-center gap-2 text-[0.8125rem] font-semibold tracking-wide text-[#949cad] uppercase"
          >
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4cc79a] opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#4cc79a]" />
            </span>
            Live now
          </h2>
          <p className="mt-3 flex items-baseline gap-3">
            <span
              className="text-[3.5rem] leading-none font-semibold tracking-[-0.04em] tabular-nums"
              data-testid="online-count"
            >
              {live.online.toLocaleString()}
            </span>
            <span className="text-[0.9375rem] text-[#949cad]">
              {live.online === 1 ? 'visitor on the site' : 'visitors on the site'}
            </span>
          </p>

          {top.length > 0 ? (
            <ul className="mt-6 space-y-2.5">
              {top.map((place) => (
                <li
                  key={`${place.country}-${place.region}`}
                  className="flex items-center justify-between gap-4 text-[0.9375rem]"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span aria-hidden="true">{flag(place.country)}</span>
                    <span className="truncate text-[#c6ccd8]">
                      {placeName(place.country, place.region)}
                    </span>
                  </span>
                  <span className="font-medium tabular-nums">{place.count.toLocaleString()}</span>
                </li>
              ))}
              {more > 0 ? (
                <li className="text-[0.8125rem] text-[#6c7485]">and {more} more places</li>
              ) : null}
            </ul>
          ) : (
            <p className="mt-6 text-[0.9375rem] text-[#949cad]">Nobody is on the site right now.</p>
          )}

          <p className="mt-6 text-[0.75rem] leading-relaxed text-[#6c7485]">
            Approximate location to the nearest region. Note reading pages and visitors who send
            Do Not Track are not counted.
          </p>
        </div>

        <div className="flex justify-center px-6 pb-6 md:px-4 md:py-4">
          <VisitorGlobe places={live.places} />
        </div>
      </div>
    </section>
  );
}

/** Where visits came from over the last 30 days, as a ranked bar list. */
function VisitPlaces({ places }: { places: AdminOverview['visits']['places'] }) {
  const top = places.slice(0, 10);
  const peak = Math.max(1, ...top.map((place) => place.visits));

  return (
    <div className="sn-card p-5 sm:p-6">
      <h2 className="text-[1.0625rem] font-semibold text-ink">Where visitors come from</h2>
      <p className="mt-1 text-[0.8125rem] text-faint">Visits by place, last 30 days</p>

      {top.length > 0 ? (
        <ol className="mt-5 space-y-3">
          {top.map((place) => (
            <li key={`${place.country}-${place.region}`}>
              <div className="flex items-center justify-between gap-4 text-[0.875rem]">
                <span className="flex min-w-0 items-center gap-2.5">
                  <span aria-hidden="true">{flag(place.country)}</span>
                  <span className="truncate text-ink-soft">
                    {placeName(place.country, place.region)}
                  </span>
                </span>
                <span className="font-medium text-ink tabular-nums">
                  {place.visits.toLocaleString()}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${Math.max(2, (place.visits / peak) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-5 text-[0.9375rem] text-muted">No visits recorded yet.</p>
      )}
    </div>
  );
}

/** The cleanup job runs daily; more than this without a run means it stopped. */
const CLEANUP_STALE_MS = 36 * 60 * 60 * 1000;

function cleanupStatus(health: AdminOverview['health']): {
  value: string;
  hint: string;
  stale: boolean;
} {
  if (!health.lastCleanupDay) {
    return { value: 'Never', hint: 'Runs daily at 03:00 UTC', stale: false };
  }
  // A run is recorded by day, so measure from the end of that day.
  const endOfDay = new Date(`${health.lastCleanupDay}T23:59:59Z`).getTime();
  const stale = new Date(health.serverTime).getTime() - endOfDay > CLEANUP_STALE_MS;
  return {
    value: health.lastCleanupDay,
    hint: stale ? 'Overdue: check the schedule' : 'Runs daily at 03:00 UTC',
    stale,
  };
}

export function AdminDashboard({ initial }: { initial: AdminOverview }) {
  const [data, setData] = useState<AdminOverview>(initial);
  const [live, setLive] = useState<LiveVisitors>(initial.visitors);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/stats', {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      if (response.status === 401) {
        router.refresh();
        return;
      }
      if (!response.ok) {
        setError('Could not load statistics.');
        return;
      }
      const overview = (await response.json()) as AdminOverview;
      setData(overview);
      setLive(overview.visitors);
      setError(null);
    } catch {
      setError('Could not reach the server.');
    }
  }, [router]);

  // The live panel refreshes far more often than the rest, from an endpoint
  // that only counts visitors. A failed refresh keeps the last good numbers.
  const loadLive = useCallback(async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      const response = await fetch('/api/admin/live', {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      if (response.ok) setLive((await response.json()) as LiveVisitors);
    } catch {
      // Transient; the next tick retries.
    }
  }, []);

  // The first snapshot arrives as a prop from the server, so this effect only
  // schedules refreshes - it never fetches on mount.
  useEffect(() => {
    const overview = setInterval(() => void load(), OVERVIEW_REFRESH_MS);
    const liveTick = setInterval(() => void loadLive(), LIVE_REFRESH_MS);
    return () => {
      clearInterval(overview);
      clearInterval(liveTick);
    };
  }, [load, loadLive]);

  async function signOut() {
    await fetch('/api/admin/session', { method: 'DELETE', credentials: 'same-origin' });
    router.refresh();
  }

  if (error) {
    return (
      <Alert tone="danger" title="Dashboard unavailable">
        {error}
      </Alert>
    );
  }

  const consumptionRate =
    data.totals.created > 0
      ? `${Math.round((data.totals.consumed / data.totals.created) * 100)}%`
      : '—';
  const cleanup = cleanupStatus(data.health);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[1.5rem] font-semibold tracking-[-0.025em] text-ink">
            ShredNote admin
          </h1>
          <p className="mt-1 text-[0.875rem] text-muted">
            Aggregate metrics only. Note contents, keys and passwords are not accessible from here
            — or from anywhere.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>

      <LivePanel live={live} />

      <section aria-labelledby="all-time">
        <h2
          id="all-time"
          className="text-[0.8125rem] font-semibold tracking-wide text-muted uppercase"
        >
          Messages, all time
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Created in total" value={data.allTime.created.toLocaleString()} />
          <Stat
            label="Read and shredded"
            value={data.allTime.consumed.toLocaleString()}
            hint="Opened once, then destroyed"
          />
          <Stat
            label="Waiting to be opened"
            value={data.live.pending.toLocaleString()}
            hint="Unread and not yet expired"
          />
          <Stat
            label="Destroyed unopened"
            value={(data.allTime.expired + data.allTime.destroyedByBruteForce).toLocaleString()}
            hint={`${data.allTime.expired.toLocaleString()} expired, ${data.allTime.destroyedByBruteForce.toLocaleString()} by failed passwords`}
          />
        </div>
      </section>

      <section aria-labelledby="totals">
        <h2 id="totals" className="text-[0.8125rem] font-semibold tracking-wide text-muted uppercase">
          Last 30 days
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Notes created" value={data.totals.created.toLocaleString()} />
          <Stat
            label="Notes read"
            value={data.totals.consumed.toLocaleString()}
            hint={`${consumptionRate} of created notes`}
          />
          <Stat label="Expired unread" value={data.totals.expired.toLocaleString()} />
          <Stat
            label="Link visits"
            value={data.totals.noteLinkVisits.toLocaleString()}
            hint="Approximate note-page traffic"
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <DailyChart data={data.daily} />
        <VisitPlaces places={data.visits.places} />
      </div>

      <section aria-labelledby="visits">
        <h2 id="visits" className="text-[0.8125rem] font-semibold tracking-wide text-muted uppercase">
          Visitors
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="On the site now" value={live.online.toLocaleString()} />
          <Stat label="Visits today" value={data.visits.today.toLocaleString()} hint="UTC day" />
          <Stat label="Visits, last 30 days" value={data.visits.last30Days.toLocaleString()} />
          <Stat
            label="Places, last 30 days"
            value={data.visits.places.length.toLocaleString()}
            hint="Distinct regions seen"
          />
        </div>
      </section>

      <section aria-labelledby="live">
        <h2 id="live" className="text-[0.8125rem] font-semibold tracking-wide text-muted uppercase">
          Currently stored
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Awaiting a reader"
            value={data.live.pending.toLocaleString()}
            hint={`${data.live.passwordProtected.toLocaleString()} password protected`}
          />
          <Stat
            label="Expiring within 24h"
            value={data.live.expiringWithin24h.toLocaleString()}
          />
          <Stat
            label="Read (tombstones)"
            value={data.live.tombstones.toLocaleString()}
            hint="Emptied records, deleted after 7 days"
          />
          <Stat
            label="Past expiry"
            value={data.live.awaitingCleanup.toLocaleString()}
            hint="Removed by the next cleanup run"
            tone={data.live.awaitingCleanup > 500 ? 'warning' : 'default'}
          />
        </div>
      </section>

      <section aria-labelledby="abuse">
        <h2 id="abuse" className="text-[0.8125rem] font-semibold tracking-wide text-muted uppercase">
          Abuse prevention
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Rate limit events"
            value={data.totals.rateLimitEvents.toLocaleString()}
            tone={data.totals.rateLimitEvents > 0 ? 'warning' : 'default'}
          />
          <Stat
            label="Failed password attempts"
            value={data.totals.failedPasswordAttempts.toLocaleString()}
          />
          <Stat
            label="Destroyed by brute force"
            value={data.totals.destroyedByBruteForce.toLocaleString()}
            hint="Notes that hit the attempt limit"
          />
          <Stat label="Active rate limit buckets" value={data.health.rateLimitBuckets.toLocaleString()} />
        </div>
      </section>

      <section aria-labelledby="system">
        <h2
          id="system"
          className="text-[0.8125rem] font-semibold tracking-wide text-muted uppercase"
        >
          Storage and health
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat
            label="Ciphertext stored"
            value={formatBytes(data.storage.ciphertextBytes)}
            hint="Unread notes only"
          />
          <Stat label="Notes table" value={formatBytes(data.storage.notesTableBytes)} />
          <Stat label="Database" value={formatBytes(data.storage.databaseBytes)} />
          <Stat
            label="Last cleanup run"
            value={cleanup.value}
            hint={cleanup.hint}
            tone={cleanup.stale ? 'warning' : 'default'}
          />
          <Stat
            label="Query latency"
            value={`${data.health.databaseLatencyMs} ms`}
            hint={data.health.databaseReachable ? 'Database reachable' : 'Database unreachable'}
          />
        </div>

        {data.health.unscrubbedConsumed > 0 ? (
          <Alert tone="warning" title="Consumed notes still holding ciphertext" className="mt-4">
            {data.health.unscrubbedConsumed} record(s) were consumed but not blanked — usually a
            process that died mid-request. The cleanup job will scrub them; if the number keeps
            growing, check that the cleanup schedule is running.
          </Alert>
        ) : null}
      </section>

      <p className="text-[0.8125rem] text-faint">
        Server time {new Date(data.health.serverTime).toLocaleString()} · live visitors refresh every 10 seconds, everything else every minute
      </p>
    </div>
  );
}
