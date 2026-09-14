'use client';

import { useEffect, useState } from 'react';

import { ButtonLink } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';

/**
 * The decrypted message.
 *
 * The text is rendered as a React text child, never as HTML, so a note
 * containing markup or a script tag is displayed literally and cannot execute.
 * That is the last link in the XSS chain: an attacker who controls a note body
 * still cannot run anything in the recipient's browser.
 */
export function RevealedNote({ message, label }: { message: string; label: string | null }) {
  const [copied, setCopied] = useState(false);

  // Warn before the message is lost to a reload, which cannot bring it back.
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  return (
    <div className="sn-rise">
      <div className="sn-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-inset px-5 py-3.5 sm:px-6">
          <p className="inline-flex items-center gap-2 text-[0.875rem] font-medium text-positive">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              className="h-[1.05rem] w-[1.05rem]"
              aria-hidden="true"
            >
              <path
                d="m5 12.5 4.5 4.5L19 7.5"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            This message has been shredded.
          </p>
          {label ? <p className="text-[0.875rem] text-muted">{label}</p> : null}
        </div>

        <div className="p-5 sm:p-6">
          <h1 className="sr-only">Your ShredNote message</h1>
          {/* `whitespace-pre-wrap` keeps the sender's formatting; the content
              is plain text, never interpreted as markup. */}
          <div className="max-h-[60vh] overflow-auto rounded-xl bg-surface-inset p-4 sm:p-5">
            <pre className="font-mono text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-ink">
              {message}
            </pre>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <CopyButton
              value={message}
              idleLabel="Copy message"
              copiedLabel="Copied"
              size="lg"
              fullWidth
              onCopied={setCopied}
            />
            <ButtonLink href="/" variant="secondary" size="lg" fullWidth>
              Create a ShredNote
            </ButtonLink>
          </div>

          {copied ? (
            <p className="sn-fade mt-3 text-center text-[0.9375rem] font-medium text-positive sm:text-left">
              Copied to your clipboard.
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-warning-soft px-5 py-4">
        <p className="text-[0.875rem] leading-relaxed text-warning">
          <strong className="font-semibold">This page is the only copy.</strong> The note has been
          deleted from ShredNote and neither you nor the sender can open the link again. Save
          anything you need before you leave.
        </p>
      </div>
    </div>
  );
}
