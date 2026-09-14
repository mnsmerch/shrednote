'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { GonePanel } from '@/components/reader/GonePanel';
import { RevealedNote } from '@/components/reader/RevealedNote';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import {
  ApiError,
  consumeNoteRequest,
  describeNoteRequest,
  type NoteDescriptionResponse,
} from '@/lib/client/api';
import {
  DecryptionError,
  decryptNote,
  deriveAuthToken,
  isCryptoSupported,
} from '@/lib/crypto/core';

type Phase =
  | 'loading'
  | 'confirm'
  | 'password'
  | 'working'
  | 'revealed'
  | 'gone'
  | 'destroyed'
  | 'broken-link'
  | 'unsupported';

/**
 * The recipient side of ShredNote.
 *
 * This component is rendered client-side only (see the `ssr: false` import in
 * page.tsx). The note page has no server-rendered content by design: nothing
 * about a note should exist in an HTML response before its recipient asks for
 * it, and it lets us read the URL fragment during the first render instead of
 * correcting the UI afterwards.
 *
 * SECURITY NOTES
 *  - The decryption key is read from `window.location.hash`, which the browser
 *    never sends to a server. It is held in a ref, never in state that could be
 *    serialised, and never included in any request.
 *  - Nothing is consumed until the recipient acts (or, when the sender turned
 *    confirmation off, until the page has loaded in a real browser). The server
 *    call that returns the ciphertext also destroys it.
 *  - After a successful reveal the fragment is stripped from the address bar so
 *    the key does not linger in history, screenshots or shoulder-surfing range.
 */
export function NoteReader({ id }: { id: string }) {
  /*
   * The key material. Read once on the first render: this component never runs
   * on the server, so the fragment is available immediately and cannot change
   * while the page is open. It is used only by the crypto layer and is never
   * placed in a request, a URL we navigate to, or a logging call.
   */
  const [fragment] = useState(() => window.location.hash.replace(/^#/, ''));
  const canDecrypt = isCryptoSupported();

  const [phase, setPhase] = useState<Phase>(() => {
    if (!canDecrypt) return 'unsupported';
    return fragment ? 'loading' : 'broken-link';
  });
  const [description, setDescription] = useState<NoteDescriptionResponse | null>(null);
  const [message, setMessage] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);

  const consuming = useRef(false);
  const passwordId = useId();

  /**
   * Consumes and decrypts the note. `note` is passed in rather than read from
   * state so the auto-reveal path can act on freshly fetched metadata without
   * waiting for a re-render.
   */
  const reveal = useCallback(
    async (note: NoteDescriptionResponse, candidatePassword: string) => {
      // Guard against double submission: consuming twice destroys the note and
      // loses the message.
      if (consuming.current) return;
      consuming.current = true;

      setError(null);
      setPhase('working');

      try {
        let authToken: string | undefined;
        if (note.passwordProtected) {
          if (candidatePassword.length === 0) {
            setPhase('password');
            setError('Enter the password the sender gave you.');
            return;
          }
          // Derived locally from the fragment and the password. It proves
          // knowledge of the password without revealing it, and cannot decrypt
          // anything on its own. Computing it here - before consuming - is
          // what lets a wrong password be rejected without losing the note.
          authToken = await deriveAuthToken(
            fragment,
            candidatePassword,
            note.kdfSalt,
            note.kdfIterations,
          );
        }

        const sealed = (await consumeNoteRequest(id, authToken)).note;

        // The note is now gone from the server. Everything below is local.
        const plaintext = await decryptNote(sealed, fragment, candidatePassword);

        setMessage(plaintext);
        setPassword('');
        setPhase('revealed');

        // Remove the key from the address bar now that it has been used.
        window.history.replaceState(null, '', window.location.pathname);
      } catch (cause) {
        if (cause instanceof ApiError) {
          if (cause.code === 'invalid_password') {
            setAttemptsRemaining(cause.attemptsRemaining ?? null);
            setError(cause.message);
            setPhase('password');
            return;
          }
          if (cause.code === 'password_required') {
            setPhase('password');
            return;
          }
          if (cause.code === 'note_destroyed') {
            setPhase('destroyed');
            return;
          }
          if (cause.code === 'note_gone') {
            setPhase('gone');
            return;
          }
          setError(cause.message);
          setPhase(note.passwordProtected ? 'password' : 'confirm');
          return;
        }

        if (cause instanceof DecryptionError) {
          // The note was consumed but could not be decrypted. Be honest about
          // what that means rather than pretending it can be retried.
          setError(cause.message);
          setPhase('broken-link');
          return;
        }

        setError('Something went wrong while opening this note.');
        setPhase(note.passwordProtected ? 'password' : 'confirm');
      } finally {
        consuming.current = false;
      }
    },
    [id, fragment],
  );

  // Fetch the note's metadata. This consumes nothing; it only decides which
  // screen the recipient sees first.
  useEffect(() => {
    if (!canDecrypt || !fragment) return;

    let cancelled = false;
    describeNoteRequest(id)
      .then((note) => {
        if (cancelled) return;
        setDescription(note);

        if (note.passwordProtected) {
          setPhase('password');
        } else if (!note.requireConfirm) {
          // The sender chose to skip the interstitial, so open it now. Doing
          // this here rather than in a second effect keeps the decision in one
          // place: we act the moment we learn what kind of note this is.
          void reveal(note, '');
        } else {
          setPhase('confirm');
        }
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        if (!(cause instanceof ApiError) || cause.code !== 'note_gone') {
          setError(
            cause instanceof ApiError
              ? cause.message
              : 'We could not reach ShredNote. Check your connection and reload.',
          );
        }
        setPhase('gone');
      });

    return () => {
      cancelled = true;
    };
    // Every dependency is stable for the life of the page, so this runs once.
    // That matters: re-running after a successful reveal would fetch metadata
    // for a note that no longer exists and replace the message with the
    // "already shredded" screen.
  }, [id, fragment, canDecrypt, reveal]);

  if (phase === 'loading') {
    return (
      <div className="sn-card flex items-center justify-center gap-3 p-12 text-muted">
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-accent"
          aria-hidden="true"
        />
        <p>Looking for this note…</p>
      </div>
    );
  }

  if (phase === 'gone') {
    return <GonePanel />;
  }

  if (phase === 'destroyed') {
    return (
      <GonePanel
        title="This ShredNote was destroyed."
        detail="Too many incorrect passwords were entered, so the note deleted itself. Ask the sender for a new one."
      />
    );
  }

  if (phase === 'unsupported') {
    return (
      <div className="sn-card p-8 sm:p-10">
        <Alert tone="danger" title="This browser cannot open ShredNotes">
          Decryption needs the Web Crypto API, which this browser does not provide. Try an up-to-date
          browser, and make sure the address starts with https://.
        </Alert>
      </div>
    );
  }

  if (phase === 'broken-link') {
    return (
      <div className="sn-card p-8 sm:p-10">
        <h1 className="text-[1.5rem] font-semibold tracking-[-0.02em] text-ink sm:text-[1.75rem]">
          This link is incomplete.
        </h1>
        <Alert tone="danger" className="mt-4">
          {error ??
            'This link is missing the part after the # symbol, which holds the decryption key. It was probably shortened or cut off when it was copied.'}
        </Alert>
        <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted">
          Ask the sender to send the full link, or to create a new note. A ShredNote link only works
          in one piece — everything after the <code className="font-mono">#</code> matters.
        </p>
      </div>
    );
  }

  if (phase === 'revealed') {
    return <RevealedNote message={message} label={description?.label ?? null} />;
  }

  const busy = phase === 'working';

  return (
    <div className="sn-rise sn-card overflow-hidden">
      <div className="p-7 sm:p-10">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            className="h-6 w-6"
            aria-hidden="true"
          >
            <path
              d="M3.5 7.5 12 13l8.5-5.5M4.5 5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11A1.5 1.5 0 0 1 4.5 5Z"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>

        <h1 className="mt-5 text-[1.625rem] font-semibold tracking-[-0.025em] text-ink sm:text-[2rem]">
          You&rsquo;ve received a ShredNote.
        </h1>
        <p className="mt-3 max-w-[48ch] text-[1.0625rem] leading-relaxed text-muted">
          This private message will be permanently destroyed after you view it.
        </p>

        {description?.label ? (
          <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-surface-muted px-3.5 py-1.5 text-[0.875rem] text-ink-soft">
            <span className="text-faint">Sender&rsquo;s label:</span>
            <span className="font-medium text-ink">{description.label}</span>
          </p>
        ) : null}

        {phase === 'password' ? (
          <form
            className="mt-7"
            onSubmit={(event) => {
              event.preventDefault();
              if (description) void reveal(description, password);
            }}
          >
            <label htmlFor={passwordId} className="block text-[0.9375rem] font-medium text-ink">
              This note is password protected
            </label>
            <p className="mt-1 text-[0.875rem] text-muted">
              Enter the password the sender shared with you.
            </p>
            <input
              id={passwordId}
              type="password"
              autoComplete="off"
              autoFocus
              value={password}
              disabled={busy}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-3 w-full rounded-xl border border-line bg-surface-inset px-3.5 py-3 text-[0.9375rem] text-ink transition-colors focus:border-accent focus:bg-surface focus:outline-none"
            />

            {error ? (
              <Alert tone="danger" className="mt-4">
                {error}
                {attemptsRemaining !== null ? (
                  <>
                    {' '}
                    <strong className="font-semibold">
                      {attemptsRemaining} attempt{attemptsRemaining === 1 ? '' : 's'} left
                    </strong>{' '}
                    before this note destroys itself.
                  </>
                ) : null}
              </Alert>
            ) : null}

            <div className="mt-5">
              <Button type="submit" size="lg" fullWidth disabled={busy || password.length === 0}>
                {busy ? 'Opening…' : 'Unlock & Shred'}
              </Button>
            </div>
          </form>
        ) : (
          <div className="mt-7">
            {error ? (
              <Alert tone="danger" className="mb-4">
                {error}
              </Alert>
            ) : null}
            <Button type="button" size="lg" fullWidth disabled={busy} onClick={() => description && void reveal(description, '')}>
              {busy ? (
                <>
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white"
                    aria-hidden="true"
                  />
                  Opening…
                </>
              ) : (
                'Reveal & Shred'
              )}
            </Button>
          </div>
        )}
      </div>

      <div className="border-t border-line bg-warning-soft px-7 py-5 sm:px-10">
        <p className="text-[0.875rem] leading-relaxed text-warning">
          <strong className="font-semibold">You can only do this once.</strong> The moment you open
          it, the message is deleted from ShredNote. Copy anything you need before closing this
          page.
        </p>
      </div>
    </div>
  );
}
