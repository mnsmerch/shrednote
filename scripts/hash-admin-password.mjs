#!/usr/bin/env node
/**
 * Generates the ADMIN_PASSWORD_HASH value for your environment.
 *
 *   npm run admin:hash
 *
 * The password is read from stdin with echo disabled and is never written to
 * disk, to shell history or to the console. Only the scrypt hash is printed.
 */
import { randomBytes, scryptSync } from 'node:crypto';

const SCRYPT_KEYLEN = 64;
const PARAMS = { N: 16384, r: 8, p: 1 };

// Must match SEPARATOR in src/lib/server/admin.ts. Deliberately not '$':
// dotenv-style loaders expand `$name` sequences even inside single quotes,
// which would corrupt the hash on load.
const SEPARATOR = '.';

function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN, { ...PARAMS });
  return [
    'scrypt',
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString('base64url'),
    derived.toString('base64url'),
  ].join(SEPARATOR);
}

/** Reads a line from the terminal without echoing it. */
function readSecret(prompt) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    if (!input.isTTY) {
      reject(new Error('admin:hash must be run in an interactive terminal.'));
      return;
    }

    process.stdout.write(prompt);
    input.setRawMode(true);
    input.resume();
    input.setEncoding('utf8');

    let value = '';
    const onData = (chunk) => {
      for (const char of chunk) {
        const code = char.charCodeAt(0);
        if (code === 13 || code === 10) {
          input.setRawMode(false);
          input.pause();
          input.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (code === 3) {
          input.setRawMode(false);
          process.stdout.write('\n');
          process.exit(130);
        }
        if (code === 127 || code === 8) {
          value = value.slice(0, -1);
          continue;
        }
        value += char;
      }
    };

    input.on('data', onData);
  });
}

const password = await readSecret('Admin password (min 12 characters): ');
const confirmation = await readSecret('Confirm password: ');

if (password.length < 12) {
  console.error('Password must be at least 12 characters.');
  process.exit(1);
}
if (password !== confirmation) {
  console.error('Passwords did not match.');
  process.exit(1);
}

console.log('\nAdd this to your environment:\n');
console.log(`ADMIN_PASSWORD_HASH=${hashPassword(password)}\n`);
console.log('Store the password itself in a password manager. It cannot be recovered');
console.log('from the hash, and there is no reset flow.\n');
