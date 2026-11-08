import { useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { syncApi } from '@/api/syncApi';
import { showToast } from '@/features/notifications/toastStore';
import { usePins } from '@/features/pins/PinsContext';
import { useSession } from '@/features/session/SessionContext';
import { useCoopStore } from './coopStore';
import { localProgress } from './localProgress';
import { startSyncEngine } from './syncEngine';

/** Syncs with the team (if any) and with other tabs while the app is mounted. */
export function useCoopSync() {
  const router = useRouter();
  const session = useSession();
  const { syncCatalog } = usePins();
  const players = useMemo(() => session.players.map((p) => p.id), [session.players]);
  const inTeam = session.team !== null;

  useEffect(() => {
    if (!inTeam) return; // solo play: nothing to sync
    return startSyncEngine(syncApi, syncCatalog, {
      players,
      // Expired session, or no longer in the team: back to the lobby.
      onUnauthorized: (message) => {
        showToast(message);
        router.replace('/');
      },
    });
  }, [inTeam, syncCatalog, players, router]);

  useEffect(() => {
    if (!session.me) return; // spectators have no own progress
    return localProgress.subscribeOwn((progress) => useCoopStore.getState().replaceOwn(progress));
  }, [session]);
}
