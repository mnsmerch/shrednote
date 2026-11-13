/**
 * Prisma CLI configuration.
 *
 * This file is read only by the Prisma CLI (`prisma migrate`, `prisma db
 * push`, `prisma generate`). The running application does not use it: it
 * connects through DATABASE_URL in src/lib/server/db.ts.
 *
 * Migrations run against a direct connection. Managed Postgres providers
 * (Neon, Supabase) put a transaction-mode pooler behind DATABASE_URL, and a
 * pooler in that mode cannot run DDL or hold the advisory lock Prisma uses to
 * serialise migrations. For a plain Postgres with no pooler, set
 * DIRECT_DATABASE_URL to the same value as DATABASE_URL.
 *
 * The URL is read from process.env rather than Prisma's env() helper because
 * env() throws when the variable is missing, and `prisma generate` runs on
 * `npm install`, where no database is configured.
 */
import { defineConfig } from 'prisma/config';

// The Prisma CLI no longer loads .env files itself.
for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(file);
  } catch {
    // Absent in CI and on Vercel, where variables come from the environment.
  }
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL ?? '',
  },
});
