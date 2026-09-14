'use client';

import { useCallback, useId, useRef, useState } from 'react';

import { MoreOptions, type NoteOptions } from '@/components/composer/MoreOptions';
import { SuccessPanel } from '@/components/composer/SuccessPanel';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { ApiError, createNoteRequest } from '@/lib/client/api';
import { useCryptoSupport } from '@/lib/client/browser';
import { CryptoUnsupportedError, encryptNote } from '@/lib/crypto/core';
import {
  DEFAULT_EXPIRY,
  MAX_MESSAGE_LENGTH,
  MIN_PASSWORD_LENGTH,
} from '@/lib/notes/constants';

type Status = 'idle' | 'encrypting' | 'done';

interface Created {
  link: string;
  expiresAt: string;
  passwordProtected: boolean;
}

const INITIAL_OPTIONS: NoteOptions = {
  expiry: DEFAULT_EXPIRY,
  password: '',
  requireConfirm: true,
  label: '',
};

/**
 * The note creation tool.
 *
 * SECURITY: the plaintext lives in this component's state and in the textarea,
 * and nowhere else. `encryptNote` runs in the browser; only its ciphertext
 * output is handed to `createNoteRequest`. The decryption key is appended to
 * the link here, client side, after the server has already responded.
 */
export function Composer() {
  const [message, setMessage] = useState('');
  const [options, setOptions] = useState<NoteOptions>(INITIAL_OPTIONS);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  // Read during render rather than in an effect; `encryptionFailed` covers the
  // rarer case where the APIs exist but refuse to work (for example a locked
  // down enterprise policy).
  const [encryptionFailed, setEncryptionFailed] = useState(false);
  const supported = useCryptoSupport() && !encryptionFailed;

  const textareaId = useId();
  const counterId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const busy = status === 'encrypting';
  const remaining = MAX_MESSAGE_LENGTH - message.length;
  const tooLong = remaining < 0;
  const passwordTooShort =
    options.password.length > 0 && options.password.length < MIN_PASSWORD_LENGTH;
  const canSubmit = message.trim().length > 0 && !tooLong && !passwordTooShort && !busy && supported;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setError(null);
    setStatus('encrypting');

    try {
      // 1. Encrypt locally. Nothing has left the browser at this point.
      const { payload, fragment } = await encryptNote(message, options.password);

      // 2. Store the ciphertext. `payload` contains no key and no plaintext.
      const response = await createNoteRequest(payload, {
        expiry: options.expiry,
        requireConfirm: options.requireConfirm,
        label: options.label.trim(),
      });

      // 3. Assemble the link here, in the browser. The fragment after `#` is
      //    never transmitted by any browser, so the server has never seen and
      //    can never see this key.
      const link = `${window.location.origin}/n/${response.id}#${fragment}`;

      setCreated({
        link,
        expiresAt: response.expiresAt,
        passwordProtected: options.password.length > 0,
      });
      setStatus('done');
      // Drop the plaintext from component state as soon as it is no longer
      // needed. Best effort - we cannot control the engine's copies.
      setMessage('');
    } catch (cause) {
      setStatus('idle');
      if (cause instanceof CryptoUnsupportedError) {
        setEncryptionFailed(true);
        setError(null);
        return;
      }
      if (cause instanceof ApiError) {
        setError(cause.message);
        return;
      }
      setError('We could not create that note. Please try again.');
    }
  }, [canSubmit, message, options]);

  const reset = useCallback(() => {
    setCreated(null);
    setOptions(INITIAL_OPTIONS);
    setStatus('idle');
    setError(null);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  if (created) {
    return (
      <SuccessPanel
        link={created.link}
        expiresAt={created.expiresAt}
        passwordProtected={created.passwordProtected}
        onCreateAnother={reset}
      />
    );
  }

  if (!supported) {
    return (
      <div className="sn-card p-6 sm:p-8">
        <Alert tone="danger" title="This browser cannot encrypt notes">
          ShredNote needs the Web Crypto API, which your browser does not provide (this usually
          means a very old browser, or a page served over plain HTTP). Please update your browser or
          open ShredNote over HTTPS.
        </Alert>
      </div>
    );
  }

  return (
    <form
      className="sn-card overflow-hidden"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
      noValidate
    >
      <div className="p-5 pb-4 sm:p-6 sm:pb-4">
        <label htmlFor={textareaId} className="sr-only">
          Your private message
        </label>
        <textarea
          id={textareaId}
          ref={textareaRef}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            // Power-user shortcut, matching the rest of the modern web.
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault();
              void handleSubmit();
            }
          }}
          placeholder="Type your private message here..."
          rows={7}
          spellCheck={false}
          autoComplete="off"
          data-1p-ignore
          disabled={busy}
          aria-describedby={counterId}
          aria-invalid={tooLong}
          className="w-full resize-y rounded-xl border-0 bg-transparent p-0 text-[1.0625rem] leading-relaxed text-ink placeholder:text-faint focus:outline-none focus-visible:outline-none sm:text-lg"
        />

        <div className="mt-3 flex items-center justify-between gap-4">
          <p id={counterId} className="text-[0.8125rem] text-faint" aria-live="polite">
            {message.length > MAX_MESSAGE_LENGTH * 0.8 || tooLong ? (
              <span className={tooLong ? 'font-medium text-danger' : ''}>
                {tooLong
                  ? `${Math.abs(remaining).toLocaleString()} characters over the limit`
                  : `${remaining.toLocaleString()} characters left`}
              </span>
            ) : (
              <span className="hidden sm:inline">Encrypted in this browser before it is sent.</span>
            )}
          </p>
          <p className="hidden text-[0.8125rem] text-faint sm:block">⌘/Ctrl + Enter</p>
        </div>
      </div>

      <MoreOptions value={options} onChange={setOptions} disabled={busy} />

      <div className="border-t border-line bg-surface-inset p-5 sm:p-6">
        {passwordTooShort ? (
          <Alert tone="warning" className="mb-4">
            Use at least {MIN_PASSWORD_LENGTH} characters for the password, or leave it empty.
          </Alert>
        ) : null}

        {error ? (
          <Alert tone="danger" className="mb-4">
            {error}
          </Alert>
        ) : null}

        <Button type="submit" size="lg" fullWidth disabled={!canSubmit}>
          {busy ? (
            <>
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white"
                aria-hidden="true"
              />
              Encrypting…
            </>
          ) : (
            'Create ShredNote'
          )}
        </Button>

        <p className="mt-3 text-center text-[0.8125rem] leading-relaxed text-muted">
          Your message is encrypted on this device. We only ever receive the encrypted result.
        </p>
      </div>
    </form>
  );
}
