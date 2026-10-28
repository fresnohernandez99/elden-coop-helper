import { useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { syncApi } from '@/api/syncApi';
import { usePins } from '@/features/pins/PinsContext';
import { useSession } from '@/features/session/SessionContext';
import { useCoopStore } from './coopStore';
import { localProgress } from './localProgress';
import { startSyncEngine } from './syncEngine';

/** Syncs with the server and with other tabs while the app is mounted. */
export function useCoopSync() {
  const router = useRouter();
  const session = useSession();
  const { syncCatalog } = usePins();
  const players = useMemo(() => session.players.map((p) => p.id), [session.players]);

  useEffect(
    () =>
      startSyncEngine(syncApi, syncCatalog, {
        players,
        // Expired session: back to the login page.
        onUnauthorized: () => router.replace('/'),
      }),
    [syncCatalog, players, router],
  );

  useEffect(() => {
    const { me } = session;
    if (!me) return; // spectators have no own progress
    return localProgress.subscribeOwn(me, (progress) => useCoopStore.getState().replaceOwn(progress));
  }, [session]);
}
