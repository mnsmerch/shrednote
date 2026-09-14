import type { Metadata } from 'next';

import { LandingPage } from '@/components/marketing/LandingPage';
import { getLandingContent } from '@/lib/landing-content';

const content = getLandingContent('self-destructing-note');

export const metadata: Metadata = {
  title: content.title,
  description: content.metaDescription,
  alternates: { canonical: '/self-destructing-note' },
  openGraph: {
    title: `${content.title} | ShredNote`,
    description: content.metaDescription,
    url: '/self-destructing-note',
    type: 'article',
  },
};

export default function Page() {
  return <LandingPage slug="self-destructing-note" />;
}
