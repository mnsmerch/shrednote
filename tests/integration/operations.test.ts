import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { GET as cleanupRoute } from '@/app/api/cron/cleanup/route';
import { createNote } from '@/lib/notes/service';
import { getAdminOverview } from '@/lib/server/analytics';
import { consume, RATE_LIMITS } from '@/lib/server/rate-limit';
import { bump } from '@/lib/server/stats';

import { prisma, resetDatabase } from '../helpers/db';
import { notePayload, readJson } from '../helpers/http';

function cronRequest(token?: string): Request {
  return new Request('http://localhost:3000/api/cron/cleanup', {
    method: 'GET',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

async function seed(message: string) {
  const { body } = await notePayload(message);
  return createNote({
    ciphertext: body.ciphertext,
    iv: body.iv,
    wrappedKey: body.wrappedKey,
    wrapIv: body.wrapIv,
    kdfSalt: body.kdfSalt,
    kdfIterations: body.kdfIterations,
    expiry: 'read',
    requireConfirm: true,
  });
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/cron/cleanup', () => {
  it('refuses requests without the shared secret', async () => {
    expect((await cleanupRoute(cronRequest())).status).toBe(401);
    expect((await cleanupRoute(cronRequest('wrong-secret'))).status).toBe(401);
    expect((await cleanupRoute(cronRequest('test-cron-secre'))).status).toBe(401);
  });

  it('deletes expired notes and prunes stale rate-limit buckets', async () => {
    const expired = await seed('expired');
    await prisma.note.update({
      where: { id: expired.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const live = await seed('live');

    await prisma.rateLimit.create({
      data: {
        key: 'stale',
        windowStart: new Date(Date.now() - 7_200_000),
        count: 5,
        expiresAt: new Date(Date.now() - 3_600_000),
      },
    });

    const response = await cleanupRoute(cronRequest('test-cron-secret'));
    expect(response.status).toBe(200);

    const result = await readJson<{ expiredDeleted: number; rateLimitsPruned: number }>(response);
    expect(result.expiredDeleted).toBe(1);
    expect(result.rateLimitsPruned).toBe(1);

    expect(await prisma.note.findUnique({ where: { id: expired.id } })).toBeNull();
    expect(await prisma.note.findUnique({ where: { id: live.id } })).not.toBeNull();
  });
});

describe('rate limiter', () => {
  it('counts within a window and isolates keys', async () => {
    const rule = { limit: 3, windowSeconds: 60 };

    expect((await consume('bucket-a', rule)).allowed).toBe(true);
    expect((await consume('bucket-a', rule)).allowed).toBe(true);
    const third = await consume('bucket-a', rule);
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);

    const fourth = await consume('bucket-a', rule);
    expect(fourth.allowed).toBe(false);
    expect(fourth.retryAfter).toBeGreaterThan(0);

    expect((await consume('bucket-b', rule)).allowed).toBe(true);
  });

  it('resets when the window rolls over', async () => {
    const rule = { limit: 1, windowSeconds: 1 };
    expect((await consume('rolling', rule)).allowed).toBe(true);
    expect((await consume('rolling', rule)).allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 1_100));
    expect((await consume('rolling', rule)).allowed).toBe(true);
  });

  it('stays correct when a single bucket is hammered concurrently', async () => {
    const rule = { limit: 10, windowSeconds: 60 };
    const results = await Promise.all(
      Array.from({ length: 30 }, () => consume('concurrent', rule)),
    );
    expect(results.filter((result) => result.allowed)).toHaveLength(10);
  });

  it('exposes production limits that are finite', () => {
    for (const rule of Object.values(RATE_LIMITS)) {
      expect(rule.limit).toBeGreaterThan(0);
      expect(rule.windowSeconds).toBeGreaterThan(0);
    }
  });
});

describe('admin analytics', () => {
  it('reports aggregates and exposes no note content or identifiers', async () => {
    const created = await seed('a message the operator must never see');
    await bump('notesCreated');
    await bump('notesConsumed');
    await bump('rateLimitHits', 3);

    const overview = await getAdminOverview();

    expect(overview.totals.created).toBe(2); // one from seed(), one explicit bump
    expect(overview.totals.rateLimitEvents).toBe(3);
    expect(overview.live.pending).toBe(1);
    expect(overview.storage.ciphertextBytes).toBeGreaterThan(0);
    expect(overview.health.databaseReachable).toBe(true);
    expect(overview.daily).toHaveLength(30);

    const serialized = JSON.stringify(overview);
    const row = await prisma.note.findUniqueOrThrow({ where: { id: created.id } });
    expect(serialized).not.toContain(created.id);
    expect(serialized).not.toContain(row.ciphertext);
    expect(serialized).not.toContain(row.wrappedKey);
    expect(serialized).not.toContain(row.kdfSalt);
  });

  it('fills every day in the window, including days with no activity', async () => {
    const overview = await getAdminOverview();
    expect(overview.daily.every((point) => /^\d{4}-\d{2}-\d{2}$/.test(point.day))).toBe(true);
    expect(overview.totals.created).toBe(0);
  });
});
