import type { MetadataRoute } from 'next';

import { LANDING_SLUGS } from '@/lib/landing-content';
import { siteUrl } from '@/lib/site';

/**
 * Only public, indexable pages appear here.
 *
 * Note pages (/n/...) are deliberately excluded and are additionally marked
 * noindex: a sitemap listing live note ids would be the single worst thing we
 * could publish.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    { url: siteUrl, lastModified, changeFrequency: 'weekly', priority: 1 },
    {
      url: `${siteUrl}/how-it-works`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    { url: `${siteUrl}/privacy`, lastModified, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${siteUrl}/about`, lastModified, changeFrequency: 'monthly', priority: 0.5 },
    ...LANDING_SLUGS.map((slug) => ({
      url: `${siteUrl}/${slug}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];
}
