import type { Metadata } from 'next';

import { LandingPage } from '@/components/marketing/LandingPage';
import { getLandingContent } from '@/lib/landing-content';

const content = getLandingContent('encrypted-note');

export const metadata: Metadata = {
  title: content.title,
  description: content.metaDescription,
  alternates: { canonical: '/encrypted-note' },
  openGraph: {
    title: `${content.title} | ShredNote`,
    description: content.metaDescription,
    url: '/encrypted-note',
    type: 'article',
  },
};

export default function Page() {
  return <LandingPage slug="encrypted-note" />;
}
