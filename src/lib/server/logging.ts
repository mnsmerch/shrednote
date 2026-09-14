/**
 * Structured, privacy-preserving logging.
 *
 * SECURITY: ShredNote must never write note contents, encryption keys, URL
 * fragments or passwords to any log. Rather than relying on every call site to
 * remember that, this module accepts only a fixed set of scalar fields and
 * drops anything else. Calling code physically cannot log a note body through
 * it, and `console` should not be used directly on the server.
 */

/** Field names that are allowed to appear in a log line. */
const ALLOWED_FIELDS = new Set([
  'event',
  'route',
  'method',
  'status',
  'outcome',
  'reason',
  'durationMs',
  'count',
  'limit',
  'windowSeconds',
  'deleted',
  'purged',
  'bytes',
  'ttlSeconds',
  'passwordProtected',
  'requireConfirm',
  'attempts',
]);

/** Substrings that must never appear in a log key, as a second line of defence. */
const FORBIDDEN_HINTS = ['secret', 'key', 'token', 'password', 'fragment', 'cipher', 'plain', 'ip'];

export type LogFields = Record<string, string | number | boolean | undefined>;

function sanitize(fields: LogFields): Record<string, string | number | boolean> {
  const safe: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    const lower = key.toLowerCase();
    if (!ALLOWED_FIELDS.has(key)) continue;
    if (FORBIDDEN_HINTS.some((hint) => lower.includes(hint))) continue;
    if (typeof value === 'string') {
      // Truncate hard: log fields are short enums, never free text.
      safe[key] = value.slice(0, 120);
    } else {
      safe[key] = value;
    }
  }
  return safe;
}

function emit(level: 'info' | 'warn' | 'error', fields: LogFields): void {
  const line = JSON.stringify({
    level,
    time: new Date().toISOString(),
    ...sanitize(fields),
  });
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const log = {
  info: (fields: LogFields) => emit('info', fields),
  warn: (fields: LogFields) => emit('warn', fields),
  /**
   * Logs that an error happened, never the error itself: exception messages
   * and stack traces can embed query parameters and payload fragments.
   */
  error: (fields: LogFields) => emit('error', fields),
};
