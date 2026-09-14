import Link from 'next/link';

import { ShredMark } from './ShredMark';

/** Wordmark + mark, used in the header and footer. */
export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-2.5 rounded-lg text-ink transition-opacity hover:opacity-80"
      aria-label="ShredNote home"
    >
      <span className="text-accent">
        <ShredMark className="h-7 w-7" />
      </span>
      <span className="text-[1.0625rem] font-semibold tracking-[-0.02em]">ShredNote</span>
    </Link>
  );
}
