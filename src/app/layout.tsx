import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import 'leaflet/dist/leaflet.css';
import '@/styles/global.css';

export const metadata: Metadata = {
  title: 'Elden Co-op Map',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover', // draw under the notch; layouts use env(safe-area-inset-*)
  themeColor: '#121212',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
