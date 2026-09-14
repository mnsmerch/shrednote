/**
 * Prisma client singleton.
 *
 * Query logging is deliberately limited to errors and warnings. Note rows
 * contain ciphertext only, but query logs would still record note ids, and we
 * have no operational need for them.
 */
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
