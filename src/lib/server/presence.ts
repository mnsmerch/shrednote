/**
 * Live visitor presence and visit counts, for the owner's dashboard.
 *
 * PRIVACY BOUNDARY: this is the only place visitor location is handled, and it
 * is deliberately coarse.
 *   - The visitor is identified by a keyed digest of their IP address that
 *     changes every UTC day. The address itself is never stored.
 *   - Location comes from headers the hosting platform sets at its edge, and
 *     only the country code, the region code and coordinates rounded to a
 *     whole degree (about 100 km) are kept. The city is discarded.
 *   - Nothing about what the visitor did is recorded: no path, no note id, no
 *     user agent, no referrer. A presence row cannot be tied to a note.
 *   - Rows are deleted shortly after the last heartbeat. What survives is a
 *     per-day, per-region integer.
 *   - Everything read back out is grouped. The dashboard never receives a
 *     digest or an individual row.
 */
import { prisma } from './db';
import { log } from './logging';
import { clientKey } from './request';

/** A visitor counts as online if they sent a heartbeat this recently. */
export const ONLINE_WINDOW_SECONDS = 120;
/** A heartbeat after this long a silence starts a new visit. */
export const VISIT_GAP_SECONDS = 30 * 60;
/** Country code used when the platform supplies no location. */
export const UNKNOWN_COUNTRY = 'XX';

export interface VisitorLocation {
  country: string;
  region: string;
  lat: number | null;
  lon: number | null;
}

export interface LivePlace extends VisitorLocation {
  count: number;
}

export interface LiveVisitors {
  online: number;
  places: LivePlace[];
  serverTime: string;
}

export interface VisitPlace {
  country: string;
  region: string;
  visits: number;
}

export interface VisitSummary {
  today: number;
  last30Days: number;
  /** Busiest places over the last 30 days, most visits first. */
  places: VisitPlace[];
  /** Visits per UTC day, keyed YYYY-MM-DD. */
  byDay: Record<string, number>;
}

function coordinate(value: string | null, limit: number): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || Math.abs(parsed) > limit) return null;
  // Whole degrees only. Precision beyond this is not needed to draw a dot on
  // a globe, and is not ours to keep.
  return Math.round(parsed);
}

/**
 * Reads the coarse location the platform attached to the request.
 *
 * These headers are set by Vercel's edge and overwrite anything the client
 * sent. Each value is still validated against a strict shape, so a
 * differently configured proxy cannot be used to store arbitrary text.
 */
export function locationFromRequest(request: Request): VisitorLocation {
  const headers = request.headers;
  const country = headers.get('x-vercel-ip-country')?.trim().toUpperCase() ?? '';
  const region = headers.get('x-vercel-ip-country-region')?.trim().toUpperCase() ?? '';

  if (!/^[A-Z]{2}$/.test(country) || country === UNKNOWN_COUNTRY) {
    return { country: UNKNOWN_COUNTRY, region: '', lat: null, lon: null };
  }

  const lat = coordinate(headers.get('x-vercel-ip-latitude'), 90);
  const lon = coordinate(headers.get('x-vercel-ip-longitude'), 180);
  const located = lat !== null && lon !== null;

  return {
    country,
    region: /^[A-Z0-9]{1,3}$/.test(region) ? region : '',
    lat: located ? lat : null,
    lon: located ? lon : null,
  };
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Records a heartbeat from a visitor.
 *
 * Like the other statistics, this must never be able to break a page, so
 * every failure is logged and swallowed.
 */
export async function touchPresence(request: Request, now = new Date()): Promise<void> {
  try {
    const key = clientKey(request, 'presence', dayKey(now));
    const { country, region, lat, lon } = locationFromRequest(request);

    // One statement reads the previous heartbeat and writes the new one, so
    // the "is this a new visit" decision cannot interleave with another
    // heartbeat from the same visitor.
    const rows = await prisma.$queryRaw<Array<{ previous: Date | null }>>`
      WITH previous AS (
        SELECT "lastSeen" FROM "presence" WHERE "key" = ${key}
      ), written AS (
        INSERT INTO "presence" ("key", "country", "region", "lat", "lon", "lastSeen")
        VALUES (${key}, ${country}, ${region}, ${lat}::smallint, ${lon}::smallint, ${now})
        ON CONFLICT ("key") DO UPDATE SET
          "country" = EXCLUDED."country",
          "region" = EXCLUDED."region",
          "lat" = EXCLUDED."lat",
          "lon" = EXCLUDED."lon",
          "lastSeen" = EXCLUDED."lastSeen"
        RETURNING 1
      )
      SELECT (SELECT "lastSeen" FROM previous) AS previous FROM written
    `;

    const previous = rows[0]?.previous ?? null;
    const newVisit =
      previous === null || now.getTime() - previous.getTime() > VISIT_GAP_SECONDS * 1000;

    if (newVisit) {
      await prisma.$executeRaw`
        INSERT INTO "visit_daily" ("day", "country", "region", "visits")
        VALUES (${dayKey(now)}::date, ${country}, ${region}, 1)
        ON CONFLICT ("day", "country", "region")
        DO UPDATE SET "visits" = "visit_daily"."visits" + 1
      `;
    }
  } catch {
    log.error({ event: 'stats_write_failed', reason: 'presence' });
  }
}

/** Deletes presence rows whose visit has ended. Returns how many went. */
export async function prunePresence(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - VISIT_GAP_SECONDS * 1000);
  const result = await prisma.presence.deleteMany({ where: { lastSeen: { lt: cutoff } } });
  return result.count;
}

/** Who is online now, grouped by place. Never returns an individual row. */
export async function getLiveVisitors(now = new Date()): Promise<LiveVisitors> {
  const since = new Date(now.getTime() - ONLINE_WINDOW_SECONDS * 1000);
  const groups = await prisma.presence.groupBy({
    by: ['country', 'region', 'lat', 'lon'],
    where: { lastSeen: { gte: since } },
    _count: { _all: true },
  });

  const places = groups
    .map((group) => ({
      country: group.country,
      region: group.region,
      lat: group.lat,
      lon: group.lon,
      count: group._count._all,
    }))
    .sort((a, b) => b.count - a.count || a.country.localeCompare(b.country));

  return {
    online: places.reduce((total, place) => total + place.count, 0),
    places,
    serverTime: now.toISOString(),
  };
}

/** Visit counts for the last 30 days. */
export async function getVisitSummary(now = new Date(), days = 30): Promise<VisitSummary> {
  const since = new Date(dayKey(new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000)));

  const [byPlace, byDayRows] = await Promise.all([
    prisma.visitDaily.groupBy({
      by: ['country', 'region'],
      where: { day: { gte: since } },
      _sum: { visits: true },
    }),
    prisma.visitDaily.groupBy({
      by: ['day'],
      where: { day: { gte: since } },
      _sum: { visits: true },
    }),
  ]);

  const byDay: Record<string, number> = {};
  for (const row of byDayRows) {
    byDay[dayKey(row.day)] = row._sum.visits ?? 0;
  }

  const places = byPlace
    .map((row) => ({ country: row.country, region: row.region, visits: row._sum.visits ?? 0 }))
    .sort((a, b) => b.visits - a.visits || a.country.localeCompare(b.country));

  return {
    today: byDay[dayKey(now)] ?? 0,
    last30Days: places.reduce((total, place) => total + place.visits, 0),
    places: places.slice(0, 50),
    byDay,
  };
}
