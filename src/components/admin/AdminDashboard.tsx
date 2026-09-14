'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import type { AdminOverview } from '@/lib/server/analytics';

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

export function AdminDashboard() {
  const [data, setData] = useState<AdminOverview | null>(null);
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
      setData((await response.json()) as AdminOverview);
      setError(null);
    } catch {
      setError('Could not reach the server.');
    }
  }, [router]);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 60_000);
    return () => clearInterval(interval);
  }, [load]);

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

  if (!data) {
    return <p className="text-muted">Loading…</p>;
  }

  const consumptionRate =
    data.totals.created > 0
      ? `${Math.round((data.totals.consumed / data.totals.created) * 100)}%`
      : '—';

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

      <DailyChart data={data.daily} />

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
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Ciphertext stored"
            value={formatBytes(data.storage.ciphertextBytes)}
            hint="Unread notes only"
          />
          <Stat label="Notes table" value={formatBytes(data.storage.notesTableBytes)} />
          <Stat label="Database" value={formatBytes(data.storage.databaseBytes)} />
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
        Server time {new Date(data.health.serverTime).toLocaleString()} · refreshes every minute
      </p>
    </div>
  );
}
