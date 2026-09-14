import type { MetadataRoute } from 'next';

import { siteUrl } from '@/lib/site';

/**
 * Note pages, the API and the admin dashboard are disallowed. Crawlers should
 * never fetch a note URL: doing so would consume a note that its recipient
 * has not read yet.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/n/', '/api/', '/admin'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
