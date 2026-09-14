'use client';

import dynamic from 'next/dynamic';

/**
 * Loads the reader in the browser only.
 *
 * Two reasons, both deliberate:
 *  1. Nothing about a note should appear in a server-rendered HTML response.
 *     The page a crawler, proxy or preview bot receives is an empty shell.
 *  2. The reader needs the URL fragment, which exists only in the browser.
 *     Rendering client-side lets it read the fragment on its first render
 *     instead of correcting the UI after hydration.
 */
const NoteReader = dynamic(
  () => import('@/components/reader/NoteReader').then((module) => module.NoteReader),
  {
    ssr: false,
    loading: () => (
      <div className="sn-card flex items-center justify-center gap-3 p-12 text-muted">
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-accent"
          aria-hidden="true"
        />
        <p>Looking for this note…</p>
      </div>
    ),
  },
);

export function NoteReaderClient({ id }: { id: string }) {
  return <NoteReader id={id} />;
}
