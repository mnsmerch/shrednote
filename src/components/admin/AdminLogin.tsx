'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';

import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';

/**
 * Single-password sign-in for the site owner.
 *
 * The password is posted once and exchanged for a signed session cookie; it is
 * never stored in component state beyond the keystroke, never placed in the
 * URL, and never logged.
 */
export function AdminLogin({ configured }: { configured: boolean }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const passwordId = useId();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        credentials: 'same-origin',
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(body?.error?.message ?? 'Incorrect password.');
        setPassword('');
        return;
      }

      setPassword('');
      router.refresh();
    } catch {
      setError('We could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-[1.5rem] font-semibold tracking-[-0.025em] text-ink">ShredNote admin</h1>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">
        Aggregate operational metrics. No note contents are accessible from here.
      </p>

      {!configured ? (
        <Alert tone="warning" title="No admin password configured" className="mt-6">
          Set <code className="font-mono">ADMIN_PASSWORD_HASH</code> in the environment. Generate a
          value with <code className="font-mono">npm run admin:hash</code>.
        </Alert>
      ) : null}

      <form onSubmit={submit} className="sn-card mt-6 p-6">
        <label htmlFor={passwordId} className="block text-[0.875rem] font-medium text-ink">
          Admin password
        </label>
        <input
          id={passwordId}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={busy || !configured}
          className="mt-2 w-full rounded-xl border border-line bg-surface-inset px-3.5 py-3 text-[0.9375rem] text-ink transition-colors focus:border-accent focus:bg-surface focus:outline-none"
        />

        {error ? (
          <Alert tone="danger" className="mt-4">
            {error}
          </Alert>
        ) : null}

        <div className="mt-5">
          <Button type="submit" fullWidth disabled={busy || !configured || password.length === 0}>
            {busy ? 'Checking…' : 'Sign in'}
          </Button>
        </div>
      </form>
    </div>
  );
}
