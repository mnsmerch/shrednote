import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ShredNote',
    short_name: 'ShredNote',
    description:
      'Send private messages and passwords with encrypted links that disappear after they are opened.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fbfbfd',
    theme_color: '#2f5fe0',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
