/**
 * The ShredNote mark: a sheet of paper whose lower edge has been cut into
 * strips. It reads as "note" at a glance and "shredded" on a second look,
 * which is the whole product in one shape.
 */
export function ShredMark({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* Sheet */}
      <path
        d="M5 4a2.5 2.5 0 0 1 2.5-2.5h9A2.5 2.5 0 0 1 19 4v10H5V4Z"
        fill="currentColor"
      />
      {/* Written lines, knocked out of the sheet */}
      <path
        d="M8 5.75h8M8 9h5.5"
        stroke="var(--surface)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Strips falling away at uneven lengths */}
      <g fill="currentColor" opacity="0.55">
        <rect x="5" y="14.6" width="2.2" height="5.2" rx="0.7" />
        <rect x="7.95" y="14.6" width="2.2" height="3.1" rx="0.7" />
        <rect x="10.9" y="14.6" width="2.2" height="6.4" rx="0.7" />
        <rect x="13.85" y="14.6" width="2.2" height="3.9" rx="0.7" />
        <rect x="16.8" y="14.6" width="2.2" height="5.6" rx="0.7" />
      </g>
    </svg>
  );
}
