import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { POST as presenceRoute } from '@/app/api/presence/route';
import { getAdminOverview } from '@/lib/server/analytics';
import {
  getLiveVisitors,
  getVisitSummary,
  locationFromRequest,
  ONLINE_WINDOW_SECONDS,
  prunePresence,
  touchPresence,
  VISIT_GAP_SECONDS,
} from '@/lib/server/presence';

import { prisma, resetDatabase } from '../helpers/db';

interface Geo {
  country?: string;
  region?: string;
  lat?: string;
  lon?: string;
  city?: string;
}

function visit(ip: string, geo: Geo = {}, sameOrigin = true): Request {
  const headers = new Headers({ 'x-forwarded-for': ip });
  if (sameOrigin) headers.set('sec-fetch-site', 'same-origin');
  if (geo.country) headers.set('x-vercel-ip-country', geo.country);
  if (geo.region) headers.set('x-vercel-ip-country-region', geo.region);
  if (geo.lat) headers.set('x-vercel-ip-latitude', geo.lat);
  if (geo.lon) headers.set('x-vercel-ip-longitude', geo.lon);
  if (geo.city) headers.set('x-vercel-ip-city', geo.city);
  return new Request('http://localhost:3000/api/presence', { method: 'POST', headers });
}

const AUSTIN: Geo = { country: 'US', region: 'TX', lat: '30.2672', lon: '-97.7431', city: 'Austin' };
const LONDON: Geo = { country: 'GB', region: 'ENG', lat: '51.5072', lon: '-0.1276', city: 'London' };

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('locationFromRequest', () => {
  it('keeps country, region and whole-degree coordinates only', () => {
    expect(locationFromRequest(visit('203.0.113.1', AUSTIN))).toEqual({
      country: 'US',
      region: 'TX',
      lat: 30,
      lon: -98,
    });
  });

  it('falls back to an unknown location when the platform sends nothing', () => {
    expect(locationFromRequest(visit('203.0.113.1'))).toEqual({
      country: 'XX',
      region: '',
      lat: null,
      lon: null,
    });
  });

  it('refuses values that are not the expected shape', () => {
    const location = locationFromRequest(
      visit('203.0.113.1', {
        country: 'US',
        region: '<script>alert(1)</script>',
        lat: '9999',
        lon: 'not-a-number',
      }),
    );
    expect(location).toEqual({ country: 'US', region: '', lat: null, lon: null });

    expect(locationFromRequest(visit('203.0.113.1', { country: 'USA; DROP TABLE' })).country).toBe(
      'XX',
    );
  });
});

describe('touchPresence', () => {
  it('stores a digest and a coarse place, never the address or the city', async () => {
    await touchPresence(visit('203.0.113.77', AUSTIN));

    const rows = await prisma.presence.findMany();
    expect(rows).toHaveLength(1);
    const serialized = JSON.stringify(rows);
    expect(serialized).not.toContain('203.0.113.77');
    expect(serialized).not.toContain('Austin');
    expect(serialized).not.toContain('30.2672');
    expect(rows[0]).toMatchObject({ country: 'US', region: 'TX', lat: 30, lon: -98 });
    // Exactly the columns we mean to keep: nothing about what was visited.
    expect(Object.keys(rows[0]!).sort()).toEqual(
      ['country', 'key', 'lastSeen', 'lat', 'lon', 'region'].sort(),
    );
  });

  it('keeps one row per visitor however many heartbeats arrive', async () => {
    await Promise.all(
      Array.from({ length: 25 }, () => touchPresence(visit('203.0.113.5', AUSTIN))),
    );
    for (let beat = 0; beat < 5; beat += 1) {
      await touchPresence(visit('203.0.113.5', AUSTIN));
    }

    expect(await prisma.presence.count()).toBe(1);
    const live = await getLiveVisitors();
    expect(live.online).toBe(1);
  });

  it('counts a visit once, and again only after a long silence', async () => {
    const start = new Date('2026-11-13T10:00:00Z');
    await touchPresence(visit('203.0.113.9', AUSTIN), start);
    await touchPresence(visit('203.0.113.9', AUSTIN), new Date(start.getTime() + 45_000));
    await touchPresence(visit('203.0.113.9', AUSTIN), new Date(start.getTime() + 90_000));
    expect((await getVisitSummary(start)).today).toBe(1);

    // The gap is measured from the last heartbeat, not the first.
    const later = new Date(start.getTime() + 90_000 + (VISIT_GAP_SECONDS + 60) * 1000);
    await touchPresence(visit('203.0.113.9', AUSTIN), later);
    expect((await getVisitSummary(later)).today).toBe(2);
  });

  it('uses a different digest each day, so days cannot be linked', async () => {
    await touchPresence(visit('203.0.113.9', AUSTIN), new Date('2026-11-13T23:59:00Z'));
    await touchPresence(visit('203.0.113.9', AUSTIN), new Date('2026-11-14T00:01:00Z'));

    const keys = (await prisma.presence.findMany()).map((row) => row.key);
    expect(new Set(keys).size).toBe(2);
  });
});

describe('getLiveVisitors', () => {
  it('groups visitors by place and forgets those who have gone quiet', async () => {
    const now = new Date('2026-11-13T12:00:00Z');
    await touchPresence(visit('203.0.113.1', AUSTIN), now);
    await touchPresence(visit('203.0.113.2', AUSTIN), now);
    await touchPresence(visit('203.0.113.3', LONDON), now);
    await touchPresence(
      visit('203.0.113.4', LONDON),
      new Date(now.getTime() - (ONLINE_WINDOW_SECONDS + 30) * 1000),
    );

    const live = await getLiveVisitors(now);
    expect(live.online).toBe(3);
    expect(live.places).toEqual([
      { country: 'US', region: 'TX', lat: 30, lon: -98, count: 2 },
      { country: 'GB', region: 'ENG', lat: 52, lon: 0, count: 1 },
    ]);
    // Grouped counts only: no digest reaches the dashboard.
    expect(JSON.stringify(live)).not.toContain('presence:');
  });

  it('prunes rows once a visit has ended', async () => {
    const now = new Date('2026-11-13T12:00:00Z');
    await touchPresence(visit('203.0.113.1', AUSTIN), now);
    await touchPresence(
      visit('203.0.113.2', AUSTIN),
      new Date(now.getTime() - (VISIT_GAP_SECONDS + 60) * 1000),
    );

    expect(await prunePresence(now)).toBe(1);
    expect(await prisma.presence.count()).toBe(1);
  });
});

describe('getVisitSummary', () => {
  it('totals visits by place and by day', async () => {
    const now = new Date('2026-11-13T12:00:00Z');
    const yesterday = new Date('2026-11-12T12:00:00Z');
    await touchPresence(visit('203.0.113.1', AUSTIN), now);
    await touchPresence(visit('203.0.113.2', AUSTIN), now);
    await touchPresence(visit('203.0.113.3', LONDON), now);
    await touchPresence(visit('203.0.113.4', LONDON), yesterday);

    const summary = await getVisitSummary(now);
    expect(summary.today).toBe(3);
    expect(summary.last30Days).toBe(4);
    expect(summary.byDay).toEqual({ '2026-11-12': 1, '2026-11-13': 3 });
    expect(summary.places).toEqual([
      { country: 'GB', region: 'ENG', visits: 2 },
      { country: 'US', region: 'TX', visits: 2 },
    ]);
  });
});

describe('POST /api/presence', () => {
  it('records a same-origin heartbeat and returns nothing', async () => {
    const response = await presenceRoute(visit('203.0.113.50', AUSTIN));
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(await prisma.presence.count()).toBe(1);
  });

  it('rejects a request from another site', async () => {
    const response = await presenceRoute(visit('203.0.113.51', AUSTIN, false));
    expect(response.status).toBe(403);
    expect(await prisma.presence.count()).toBe(0);
  });
});

describe('admin visitor data', () => {
  it('is included in the overview as grouped counts', async () => {
    await touchPresence(visit('203.0.113.60', AUSTIN));
    await touchPresence(visit('203.0.113.61', LONDON));

    const overview = await getAdminOverview();
    expect(overview.visitors.online).toBe(2);
    expect(overview.visits.today).toBe(2);
    expect(overview.visits.places).toHaveLength(2);
    expect(overview.allTime).toEqual({
      created: 0,
      consumed: 0,
      expired: 0,
      destroyedByBruteForce: 0,
    });
    expect(overview.health.lastCleanupDay).toBeNull();

    const serialized = JSON.stringify(overview);
    expect(serialized).not.toContain('203.0.113.60');
    expect(serialized).not.toContain('presence:');
  });
});
