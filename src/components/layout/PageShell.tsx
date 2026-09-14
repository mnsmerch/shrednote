import type { ReactNode } from 'react';

/** Shared header + measure for every content page. */
export function PageShell({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl px-5 py-14 sm:px-6 sm:py-20">
      <header>
        {eyebrow ? (
          <p className="text-[0.8125rem] font-semibold tracking-wide text-accent uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-2 text-[2rem] leading-[1.12] font-semibold tracking-[-0.03em] text-ink sm:text-[2.75rem]">
          {title}
        </h1>
        {lead ? (
          <p className="mt-4 text-[1.125rem] leading-relaxed text-muted sm:text-[1.1875rem]">
            {lead}
          </p>
        ) : null}
      </header>

      <div className="sn-prose mt-10">{children}</div>
    </article>
  );
}
