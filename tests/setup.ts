/**
 * Test bootstrap.
 *
 * Points every server module at the dedicated test database and supplies the
 * secrets the server code validates. These values are throwaway.
 */
// NODE_ENV is typed read-only; assign through a widened reference.
(process.env as Record<string, string | undefined>).NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/shrednote_test';
process.env.DIRECT_DATABASE_URL = process.env.DATABASE_URL;
process.env.SERVER_SECRET = 'test-server-secret-value-that-is-long-enough-000000';
process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
process.env.CRON_SECRET = 'test-cron-secret';
