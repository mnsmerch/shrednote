import type { Metadata } from 'next';

import { LandingPage } from '@/components/marketing/LandingPage';
import { getLandingContent } from '@/lib/landing-content';

const content = getLandingContent('burn-after-reading-message');

export const metadata: Metadata = {
  title: content.title,
  description: content.metaDescription,
  alternates: { canonical: '/burn-after-reading-message' },
  openGraph: {
    title: `${content.title} | ShredNote`,
    description: content.metaDescription,
    url: '/burn-after-reading-message',
    type: 'article',
  },
};

export default function Page() {
  return <LandingPage slug="burn-after-reading-message" />;
}
