'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from './Button';

/**
 * Copies text to the clipboard with a graceful fallback.
 *
 * `navigator.clipboard` is unavailable in non-secure contexts and in some
 * in-app browsers, so we fall back to a hidden textarea + execCommand rather
 * than leaving the user with a button that silently does nothing.
 */
export async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall through to the legacy path.
  }

  try {
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    area.style.pointerEvents = 'none';
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(area);
    return copied;
  } catch {
    return false;
  }
}

export function CopyButton({
  value,
  idleLabel = 'Copy link',
  copiedLabel = 'Copied',
  size = 'lg',
  fullWidth,
  onCopied,
}: {
  value: string;
  idleLabel?: string;
  copiedLabel?: string;
  size?: 'md' | 'lg';
  fullWidth?: boolean;
  onCopied?: (success: boolean) => void;
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const handleCopy = useCallback(async () => {
    const success = await copyText(value);
    setState(success ? 'copied' : 'failed');
    onCopied?.(success);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 2600);
  }, [value, onCopied]);

  return (
    <Button
      type="button"
      size={size}
      fullWidth={fullWidth}
      onClick={handleCopy}
      aria-live="polite"
      className="min-w-[9.5rem]"
    >
      {state === 'copied' ? (
        <>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            className="h-[1.15rem] w-[1.15rem]"
            aria-hidden="true"
          >
            <path
              d="m5 12.5 4.5 4.5L19 7.5"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {copiedLabel}
        </>
      ) : (
        <>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            className="h-[1.15rem] w-[1.15rem]"
            aria-hidden="true"
          >
            <rect x="9" y="9" width="11" height="11" rx="2.5" strokeWidth="1.7" />
            <path
              d="M15 5.5A2.5 2.5 0 0 0 12.5 3h-6A3.5 3.5 0 0 0 3 6.5v6A2.5 2.5 0 0 0 5.5 15"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
          {state === 'failed' ? 'Press Ctrl/Cmd + C' : idleLabel}
        </>
      )}
    </Button>
  );
}
