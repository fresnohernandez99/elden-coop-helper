import type { NextConfig } from 'next';

const IMMUTABLE = 'public, max-age=31536000, immutable';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      // Static images never change under the same name. Remote tiles and popup
      // images get the same treatment in src/server/imageProxy.ts.
      { source: '/icons/:path*', headers: [{ key: 'Cache-Control', value: IMMUTABLE }] },
      { source: '/map-tiles/:path*', headers: [{ key: 'Cache-Control', value: IMMUTABLE }] },
    ];
  },
};

export default nextConfig;
