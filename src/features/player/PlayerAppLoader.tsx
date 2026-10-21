'use client';

import dynamic from 'next/dynamic';
import { StatusScreen } from './StatusScreen';

/**
 * Leaflet needs `window`, so the player app only renders in the browser.
 * This component bridges the server page and the client-only app.
 */
export const PlayerAppLoader = dynamic(() => import('./PlayerApp').then((m) => m.PlayerApp), {
  ssr: false,
  loading: () => <StatusScreen>Loading map…</StatusScreen>,
});
