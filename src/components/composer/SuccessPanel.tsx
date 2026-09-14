'use client';

import { useState } from 'react';

import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';

/** Shown once the note exists and the link has been assembled in the browser. */
export function SuccessPanel({
  link,
  expiresAt,
  passwordProtected,
  onCreateAnother,
}: {
  link: string;
  expiresAt: string;
  passwordProtected: boolean;
  onCreateAnother: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const expiryLabel = new Date(expiresAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <div className="sn-rise sn-card p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-positive-soft text-positive">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path
              d="m5 12.5 4.5 4.5L19 7.5"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-ink sm:text-2xl">
            Your ShredNote is ready.
          </h2>
          <p className="mt-0.5 text-[0.9375rem] text-muted">
            Send this link to the person you trust.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <label
          htmlFor="shrednote-link"
          className="block text-[0.8125rem] font-semibold tracking-wide text-muted uppercase"
        >
          Your one-time link
        </label>
        <input
          id="shrednote-link"
          readOnly
          value={link}
          onFocus={(event) => event.currentTarget.select()}
          className="mt-2 w-full rounded-xl border border-line bg-surface-inset px-3.5 py-3.5 font-mono text-[0.8125rem] break-all text-ink selection:bg-accent-soft sm:text-sm"
        />
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <CopyButton value={link} size="lg" fullWidth onCopied={setCopied} />
        <Button type="button" variant="secondary" size="lg" fullWidth onClick={onCreateAnother}>
          Create another
        </Button>
      </div>

      {copied ? (
        <p className="sn-fade mt-3 text-center text-[0.9375rem] font-medium text-positive sm:text-left">
          Copied. Send it to the person you trust.
        </p>
      ) : null}

      <div className="mt-6 space-y-3">
        <Alert tone="warning" title="This link can only be opened once.">
          Do not open it yourself unless you want to destroy the note. Once it has been read, nobody
          — including us — can recover the message.
        </Alert>

        {passwordProtected ? (
          <Alert tone="info">
            You added a password. Send it through a different channel, and remember it: we cannot
            reset it or recover the note without it.
          </Alert>
        ) : null}

        <p className="text-[0.875rem] leading-relaxed text-muted">
          If nobody opens it, this note is deleted automatically on{' '}
          <span className="font-medium text-ink-soft">{expiryLabel}</span>.
        </p>
      </div>
    </div>
  );
}
