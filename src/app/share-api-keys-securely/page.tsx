import type { Metadata } from 'next';

import { LandingPage } from '@/components/marketing/LandingPage';
import { getLandingContent } from '@/lib/landing-content';

const content = getLandingContent('share-api-keys-securely');

export const metadata: Metadata = {
  title: content.title,
  description: content.metaDescription,
  alternates: { canonical: '/share-api-keys-securely' },
  openGraph: {
    title: `${content.title} | ShredNote`,
    description: content.metaDescription,
    url: '/share-api-keys-securely',
    type: 'article',
  },
};

export default function Page() {
  return <LandingPage slug="share-api-keys-securely" />;
}
