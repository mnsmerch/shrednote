import type { Metadata } from 'next';

import { LandingPage } from '@/components/marketing/LandingPage';
import { getLandingContent } from '@/lib/landing-content';

const content = getLandingContent('one-time-secret');

export const metadata: Metadata = {
  title: content.title,
  description: content.metaDescription,
  alternates: { canonical: '/one-time-secret' },
  openGraph: {
    title: `${content.title} | ShredNote`,
    description: content.metaDescription,
    url: '/one-time-secret',
    type: 'article',
  },
};

export default function Page() {
  return <LandingPage slug="one-time-secret" />;
}
