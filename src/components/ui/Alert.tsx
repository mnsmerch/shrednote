import type { ReactNode } from 'react';

type Tone = 'info' | 'warning' | 'danger' | 'positive';

const TONES: Record<Tone, { wrapper: string; icon: string; path: ReactNode }> = {
  info: {
    wrapper: 'bg-accent-soft text-accent-ink',
    icon: 'text-accent',
    path: (
      <path
        d="M12 16v-5m0-3.5h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  warning: {
    wrapper: 'bg-warning-soft text-warning',
    icon: 'text-warning',
    path: (
      <path
        d="M12 9.5v4m0 3h.01M10.3 3.8 2.6 17.1A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.9L13.7 3.8a2 2 0 0 0-3.4 0Z"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  danger: {
    wrapper: 'bg-danger-soft text-danger',
    icon: 'text-danger',
    path: (
      <path
        d="M12 8v4.5m0 3h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  positive: {
    wrapper: 'bg-positive-soft text-positive',
    icon: 'text-positive',
    path: (
      <path
        d="m8 12.5 2.8 2.8L16.5 9.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
};

/**
 * Inline message block. `role="alert"` is applied for error tones so screen
 * readers announce failures immediately.
 */
export function Alert({
  tone = 'info',
  title,
  children,
  className = '',
}: {
  tone?: Tone;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const config = TONES[tone];
  const assertive = tone === 'danger' || tone === 'warning';

  return (
    <div
      role={assertive ? 'alert' : 'status'}
      className={`flex gap-3 rounded-xl px-4 py-3 text-[0.9375rem] leading-relaxed ${config.wrapper} ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        className={`mt-0.5 h-[1.15rem] w-[1.15rem] shrink-0 ${config.icon}`}
        aria-hidden="true"
      >
        {config.path}
      </svg>
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={title ? 'mt-0.5' : ''}>{children}</div>
      </div>
    </div>
  );
}
