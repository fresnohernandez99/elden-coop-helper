import type { MetadataRoute } from 'next';

/** Web app manifest: lets Chrome (and other browsers) install the map as a standalone app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Elden Co-op Map',
    short_name: 'Co-op Map',
    description: 'Shared Elden Ring map for co-op progress.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#121212',
    theme_color: '#121212',
    icons: [
      { src: '/app-icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/app-icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/app-icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
