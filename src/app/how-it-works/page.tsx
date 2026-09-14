import type { Metadata } from 'next';
import Link from 'next/link';

import { PageShell } from '@/components/layout/PageShell';
import { JsonLd } from '@/components/seo/JsonLd';
import { ButtonLink } from '@/components/ui/Button';
import { siteUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: 'How ShredNote works',
  description:
    'A step-by-step explanation of how ShredNote encrypts your message in the browser, why the encryption key never reaches our servers, and what happens when a note is read.',
  alternates: { canonical: '/how-it-works' },
};

const STEPS = [
  {
    title: 'Write your message',
    body: 'You type into the box on the homepage. Nothing has been sent anywhere yet — the text exists only in your browser tab.',
  },
  {
    title: 'Your browser encrypts it',
    body: 'ShredNote generates a random 256-bit key using your browser’s built-in Web Crypto API and encrypts the message with AES-256-GCM. GCM also authenticates the ciphertext, so any later tampering is detected rather than silently decrypted into something else.',
  },
  {
    title: 'ShredNote creates a private link',
    body: 'Only the encrypted result is uploaded. The server stores it under a random 22-character identifier and returns that identifier. Your browser then builds the link and appends the key after a # symbol.',
  },
  {
    title: 'Your recipient opens the link',
    body: 'They see a short warning page, then choose to reveal the note. Their browser asks our server for the ciphertext and decrypts it locally with the key from the link.',
  },
  {
    title: 'The encrypted note is permanently deleted',
    body: 'The same database statement that hands over the ciphertext also marks the note consumed and blanks it. There is no second copy, no backup of the plaintext, and no way for us to reconstruct it.',
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'HowTo',
          name: 'How to send a self-destructing note with ShredNote',
          description:
            'Write a private message, let your browser encrypt it, share the one-time link, and have it destroy itself once it is read.',
          totalTime: 'PT1M',
          url: `${siteUrl}/how-it-works`,
          step: STEPS.map((step, index) => ({
            '@type': 'HowToStep',
            position: index + 1,
            name: step.title,
            text: step.body,
          })),
        }}
      />

      <PageShell
        eyebrow="How it works"
        title="Five steps, and then it&rsquo;s gone."
        lead="ShredNote is deliberately small. Here is everything that happens between typing a message and it ceasing to exist."
      >
        <ol className="!mt-2 !list-none !pl-0">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-4 border-b border-line py-6 last:border-0">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[0.9375rem] font-semibold text-accent-ink">
                {index + 1}
              </span>
              <div>
                <h2 className="!mt-0 !mb-1 !text-[1.125rem]">{step.title}</h2>
                <p className="!mt-0">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <h2>The part after the # symbol</h2>
        <p>
          A ShredNote link looks like this:
        </p>
        <p className="rounded-xl bg-surface-inset p-4 font-mono !text-[0.875rem] break-all">
          https://shrednote.com/n/<span className="text-accent">Yb3kQ1r8hTn2wVxA0cLmZq</span>
          <span className="text-warning">#1.pV7s2Nn4kX0aQdR9tLcE8yUmB6gJfH3wZ1oS5iT2rKq</span>
        </p>
        <p>
          The blue part is the note&rsquo;s address. The orange part — everything after{' '}
          <code className="font-mono">#</code> — is the decryption key.
        </p>
        <p>
          <strong>
            Browsers never send the fragment after a <code className="font-mono">#</code> to the
            server.
          </strong>{' '}
          It is not in the request line, not in any header, and not in a server access log. This is a
          long-standing part of how URLs work, not something we implemented. It means we can host
          your ciphertext without ever being able to read it — and it means we cannot help an
          attacker, a subpoena or a curious employee read it either.
        </p>
        <p>
          The flip side is equally important: if the link is truncated when it is copied, or a chat
          app strips the fragment, the note becomes permanently unreadable. Always share the whole
          link.
        </p>

        <h2>Optional password protection</h2>
        <p>
          A password adds a second, independent lock. Your browser stretches it with PBKDF2-SHA256
          (600,000 iterations) and mixes the result with the link secret to derive the key that
          protects the note. Both halves are required: the link alone is not enough, and the password
          alone is not enough.
        </p>
        <p>
          So that a typo does not destroy the message, your browser separately derives a proof of
          knowledge — a value that is mathematically independent of the decryption key — and sends
          only that. The server can check it, but it grants no ability to decrypt anything. After ten
          wrong attempts the note destroys itself.
        </p>

        <h2>What we can see</h2>
        <ul>
          <li>That a note was created, its size, and when it expires.</li>
          <li>The reference label, if the sender added one — it is stored unencrypted on purpose.</li>
          <li>That a note was read, and when.</li>
        </ul>
        <p>We cannot see the message, the key, the password, or who the recipient is.</p>

        <h2>What ShredNote cannot protect you from</h2>
        <p>
          We would rather be useful than reassuring, so: ShredNote shortens how long a secret is
          exposed. It does not make sharing a secret safe.
        </p>
        <ul>
          <li>
            Anyone who gets the link before your recipient can read the note, and your recipient will
            simply find it already opened.
          </li>
          <li>
            If either device is compromised — malware, a screen recorder, someone reading over a
            shoulder — the message is exposed regardless of the encryption.
          </li>
          <li>
            Like every browser-based encryption tool, you are trusting that the JavaScript we serve
            is the JavaScript we describe. That is a real assumption, and no in-browser product can
            remove it.
          </li>
          <li>
            A determined recipient can screenshot, copy or forward the message. &ldquo;Destroyed
            after reading&rdquo; means our copy is gone, not theirs.
          </li>
        </ul>

        <div className="mt-12 flex flex-wrap gap-3">
          <ButtonLink href="/" size="lg">
            Create a ShredNote
          </ButtonLink>
          <Link
            href="/privacy"
            className="inline-flex h-14 items-center rounded-xl px-5 font-semibold !text-ink-soft !no-underline transition-colors hover:bg-surface-muted hover:!text-ink"
          >
            Read the privacy policy
          </Link>
        </div>
      </PageShell>
    </>
  );
}
