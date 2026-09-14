import type { Metadata } from 'next';

import { LandingPage } from '@/components/marketing/LandingPage';
import { getLandingContent } from '@/lib/landing-content';

const content = getLandingContent('secure-message-link');

export const metadata: Metadata = {
  title: content.title,
  description: content.metaDescription,
  alternates: { canonical: '/secure-message-link' },
  openGraph: {
    title: `${content.title} | ShredNote`,
    description: content.metaDescription,
    url: '/secure-message-link',
    type: 'article',
  },
};

export default function Page() {
  return <LandingPage slug="secure-message-link" />;
}
