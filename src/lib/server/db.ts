/**
 * Prisma client singleton.
 *
 * Query logging is deliberately limited to errors and warnings. Note rows
 * contain ciphertext only, but query logs would still record note ids, and we
 * have no operational need for them.
 *
 * The client talks to PostgreSQL through the node-postgres driver adapter,
 * using DATABASE_URL (the pooled connection string where the provider offers
 * one). Migrations use DIRECT_DATABASE_URL instead; see prisma.config.ts.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    log: ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
