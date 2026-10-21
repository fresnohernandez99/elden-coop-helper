'use client';

import { useState } from 'react';
import { useCoopStore } from '@/features/coop/coopStore';
import { PinsProvider } from '@/features/pins/PinsContext';
import { SessionProvider } from '@/features/session/SessionContext';
import { useUiStore } from '@/features/ui/uiStore';
import type { PinsData, Session } from '@/types/domain';
import { AppLayout } from './AppLayout';
import { StatusScreen } from './StatusScreen';
import { usePinsData } from './usePinsData';

export interface PlayerAppProps {
  session: Session;
}

export function PlayerApp({ session }: PlayerAppProps) {
  // Load the progress stored in this browser once, before the first render.
  useState(() => {
    useCoopStore.getState().initialize(session.me);
    useUiStore.getState().setNextNote(useCoopStore.getState().players[session.me].next?.note ?? '');
  });

  const pins = usePinsData(initializeCurrentMap);

  switch (pins.status) {
    case 'loading':
      return <StatusScreen>Loading map…</StatusScreen>;
    case 'error':
      return <StatusScreen>Could not load: {pins.message}</StatusScreen>;
    case 'ready':
      return (
        <SessionProvider session={session}>
          <PinsProvider data={pins.data}>
            <AppLayout />
          </PinsProvider>
        </SessionProvider>
      );
  }
}

/** The remembered map may no longer exist if pins.json changed. */
function initializeCurrentMap(data: PinsData) {
  const ui = useUiStore.getState();
  if (!data.maps.some((m) => m.title === ui.currentMap) && data.maps[0]) {
    ui.setCurrentMap(data.maps[0].title);
  }
}
