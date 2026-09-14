import { prisma } from '@/lib/server/db';

/** Wipes every table so each test file starts from a known state. */
export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "notes", "rate_limits", "daily_stats" RESTART IDENTITY CASCADE',
  );
}

export { prisma };
