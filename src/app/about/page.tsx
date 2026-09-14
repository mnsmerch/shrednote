import type { Metadata } from 'next';

import { PageShell } from '@/components/layout/PageShell';
import { ButtonLink } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Why ShredNote exists, what it deliberately does not do, and the principles behind a free tool for sending a secret exactly once.',
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <PageShell
      eyebrow="About"
      title="A small tool that does one thing."
      lead="ShredNote exists because sharing a secret usually means leaving a permanent copy of it somewhere it does not belong."
    >
      <p>
        Passwords get pasted into chat threads. API keys end up in email, which is archived, indexed
        and searchable forever. WiFi credentials sit in a text message on a phone that gets sold two
        years later. Every one of those is a copy of a secret with no expiry date on it.
      </p>
      <p>
        ShredNote gives you one link that works exactly once and then stops existing. That is the
        whole product.
      </p>

      <h2>Principles</h2>

      <h3>The server should not be trusted with your message</h3>
      <p>
        Anything we could read, we could also be compelled to hand over, or lose in a breach. So we
        arranged not to be able to read it. Your browser encrypts the message and puts the key in
        the part of the link that browsers never transmit. The design is what protects you, not our
        good intentions.
      </p>

      <h3>Simple beats configurable</h3>
      <p>
        The homepage is a text box and a button. Expiry, passwords and confirmation live behind
        &ldquo;More options&rdquo; because most people need none of them. A tool you have to learn is
        a tool people route around.
      </p>

      <h3>No accounts for the basic thing</h3>
      <p>
        Sending someone a password should not require creating a profile. The core experience will
        always work without an account, without an email address, and for free.
      </p>

      <h3>Say what is true</h3>
      <p>
        We do not claim to be unhackable, military-grade or 100% secure. ShredNote reduces how long
        a secret is exposed and removes the permanent copy. It cannot protect a secret from a
        compromised device, from someone who intercepts the link, or from a recipient who takes a
        screenshot. Our{' '}
        <a href="/how-it-works">How it works</a> and <a href="/privacy">Privacy</a> pages list those
        limits plainly rather than burying them.
      </p>

      <h2>What ShredNote is not</h2>
      <ul>
        <li>
          <strong>Not a password manager.</strong> For credentials you use repeatedly, use a
          dedicated manager. ShredNote is for handing a secret over, once.
        </li>
        <li>
          <strong>Not anonymous messaging.</strong> It hides the content of a note, not the fact
          that you sent a link to someone.
        </li>
        <li>
          <strong>Not a file transfer service.</strong> Today it carries text. Attachments are a
          natural extension, but they are not here yet and we would rather ship nothing than ship a
          half-secure version.
        </li>
      </ul>

      <h2>What might come later</h2>
      <p>
        The free product is intended to stay as it is: complete, unlimited enough for normal use,
        and free. If ShredNote ever grows a paid tier, it would be for teams that need things
        individuals do not — longer expiry windows, file attachments, custom domains, shared audit
        metadata, an API. None of that would change the encryption model, and none of it would put
        the basic tool behind a sign-up form.
      </p>

      <div className="mt-12">
        <ButtonLink href="/" size="lg">
          Create a ShredNote
        </ButtonLink>
      </div>
    </PageShell>
  );
}
