import type { Metadata } from 'next';

import { NoteReaderClient } from './NoteReaderClient';

/**
 * The recipient's page.
 *
 * Rendered as an empty shell: the note is fetched, consumed and decrypted in
 * the browser. Nothing about the note is rendered on the server, so a note is
 * never touched by a link preview crawler, a proxy cache or our own logs
 * before its recipient asks for it.
 */
export const metadata: Metadata = {
  title: 'Private note',
  description: 'Someone sent you a private, self-destructing message.',
  // Note pages must never be indexed, archived or previewed.
  robots: { index: false, follow: false, nocache: true, noarchive: true, nosnippet: true },
};

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-2xl px-5 py-12 sm:px-6 sm:py-20">
      <NoteReaderClient id={id} />
    </div>
  );
}
