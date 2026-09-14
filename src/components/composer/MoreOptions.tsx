'use client';

import { useId, useState } from 'react';

import { EXPIRY_OPTIONS, MAX_LABEL_LENGTH, type ExpiryOption } from '@/lib/notes/constants';

export interface NoteOptions {
  expiry: ExpiryOption;
  password: string;
  requireConfirm: boolean;
  label: string;
}

const FIELD =
  'w-full rounded-xl border border-line bg-surface-inset px-3.5 py-3 text-[0.9375rem] ' +
  'text-ink placeholder:text-faint transition-colors focus:border-accent focus:bg-surface ' +
  'focus:outline-none focus-visible:outline-none';

/**
 * Progressive disclosure for the settings most people never need.
 *
 * Implemented as a real <button aria-expanded> + region rather than <details>
 * so the open state can be styled and announced consistently across browsers.
 */
export function MoreOptions({
  value,
  onChange,
  disabled,
}: {
  value: NoteOptions;
  onChange: (next: NoteOptions) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const expiryId = useId();
  const passwordId = useId();
  const labelId = useId();
  const confirmId = useId();

  const update = <K extends keyof NoteOptions>(key: K, next: NoteOptions[K]) =>
    onChange({ ...value, [key]: next });

  const activeExpiry = EXPIRY_OPTIONS.find((option) => option.value === value.expiry);

  return (
    <div className="border-t border-line">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-2 px-5 py-3.5 text-[0.875rem] font-medium text-muted transition-colors hover:text-ink sm:px-6"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
          aria-hidden="true"
        >
          <path d="m9 5 7 7-7 7" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        More options
        {!open && (value.password || value.label || value.expiry !== 'read') ? (
          <span className="ml-1 rounded-full bg-accent-soft px-2 py-0.5 text-[0.75rem] font-semibold text-accent-ink">
            on
          </span>
        ) : null}
      </button>

      <div id={panelId} hidden={!open} className="sn-fade px-5 pb-6 sm:px-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor={expiryId} className="block text-[0.875rem] font-medium text-ink">
              Expiration
            </label>
            <select
              id={expiryId}
              value={value.expiry}
              disabled={disabled}
              onChange={(event) => update('expiry', event.target.value as ExpiryOption)}
              className={`${FIELD} mt-1.5 appearance-none bg-[length:1rem] bg-[right_0.9rem_center] bg-no-repeat pr-10`}
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23697084' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
              }}
            >
              {EXPIRY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">
              {activeExpiry?.hint}
            </p>
          </div>

          <div>
            <label htmlFor={passwordId} className="block text-[0.875rem] font-medium text-ink">
              Password{' '}
              <span className="font-normal text-faint">(optional)</span>
            </label>
            <input
              id={passwordId}
              type="password"
              autoComplete="new-password"
              value={value.password}
              disabled={disabled}
              onChange={(event) => update('password', event.target.value)}
              placeholder="Adds a second lock"
              className={`${FIELD} mt-1.5`}
              aria-describedby={`${passwordId}-hint`}
            />
            <p
              id={`${passwordId}-hint`}
              className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted"
            >
              Share it separately — by phone, not in the same message.
            </p>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor={labelId} className="block text-[0.875rem] font-medium text-ink">
              Reference label <span className="font-normal text-faint">(optional)</span>
            </label>
            <input
              id={labelId}
              type="text"
              value={value.label}
              disabled={disabled}
              maxLength={MAX_LABEL_LENGTH}
              onChange={(event) => update('label', event.target.value)}
              placeholder="Server login, WiFi password, Document access…"
              className={`${FIELD} mt-1.5`}
              aria-describedby={`${labelId}-hint`}
            />
            <p
              id={`${labelId}-hint`}
              className="mt-1.5 text-[0.8125rem] leading-relaxed text-warning"
            >
              This label is <strong className="font-semibold">not encrypted</strong>. It is shown to
              the recipient before they open the note — keep it generic and never put anything
              private in it.
            </p>
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor={confirmId}
              className="flex cursor-pointer items-start gap-3 rounded-xl bg-surface-inset p-3.5"
            >
              <input
                id={confirmId}
                type="checkbox"
                checked={value.requireConfirm}
                disabled={disabled}
                onChange={(event) => update('requireConfirm', event.target.checked)}
                className="mt-0.5 h-4.5 w-4.5 shrink-0 accent-[var(--accent)]"
              />
              <span className="text-[0.875rem] leading-relaxed text-ink-soft">
                <span className="font-medium text-ink">Confirm before showing the message</span>
                <br />
                The recipient sees a warning first, so a link preview or an accidental click cannot
                destroy the note.
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
