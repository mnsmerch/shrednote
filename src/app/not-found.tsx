import type { Metadata } from 'next';

import { ButtonLink } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-5 py-24 text-center sm:px-6 sm:py-32">
      <p className="text-[0.8125rem] font-semibold tracking-wide text-accent uppercase">404</p>
      <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.03em] text-ink sm:text-[2.5rem]">
        We could not find that page.
      </h1>
      <p className="mx-auto mt-4 max-w-[42ch] text-[1.0625rem] leading-relaxed text-muted">
        If you were following a ShredNote link, check that you copied the whole thing — including
        everything after the <code className="font-mono">#</code> symbol.
      </p>
      <div className="mt-8">
        <ButtonLink href="/" size="lg">
          Go to ShredNote
        </ButtonLink>
      </div>
    </div>
  );
}
