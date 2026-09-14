import { ButtonLink } from '@/components/ui/Button';

/**
 * The second-visit screen.
 *
 * Deliberately says the same thing whether the note was read, expired, deleted
 * or never existed. Distinguishing those cases would turn this page into an
 * oracle for probing note ids.
 */
export function GonePanel({
  title = 'This ShredNote is gone.',
  detail = 'It may have already been opened or expired.',
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <div className="sn-rise sn-card p-8 text-center sm:p-12">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-muted text-muted">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          className="h-7 w-7"
          aria-hidden="true"
        >
          <path
            d="M4 7h16M9.5 7V5.6A1.6 1.6 0 0 1 11.1 4h1.8a1.6 1.6 0 0 1 1.6 1.6V7m3.1 0-.8 11.3a2 2 0 0 1-2 1.7H8.2a2 2 0 0 1-2-1.7L5.4 7"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      <h1 className="mt-6 text-[1.625rem] font-semibold tracking-[-0.025em] text-ink sm:text-[2rem]">
        {title}
      </h1>
      <p className="mx-auto mt-3 max-w-[42ch] text-[1.0625rem] leading-relaxed text-muted">
        {detail}
      </p>

      <div className="mt-8">
        <ButtonLink href="/" size="lg">
          Create a ShredNote
        </ButtonLink>
      </div>

      <p className="mx-auto mt-6 max-w-[44ch] text-[0.875rem] leading-relaxed text-faint">
        If you were expecting a message, ask the sender to create a new one. Notes cannot be
        recovered once they have been opened.
      </p>
    </div>
  );
}
