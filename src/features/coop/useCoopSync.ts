import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { syncApi } from '@/api/syncApi';
import { usePins } from '@/features/pins/PinsContext';
import { useSession } from '@/features/session/SessionContext';
import { useCoopStore } from './coopStore';
import { localProgress } from './localProgress';
import { startSyncEngine } from './syncEngine';

/** Syncs with the server and with other tabs while the app is mounted. */
export function useCoopSync() {
  const router = useRouter();
  const { me } = useSession();
  const { syncCatalog } = usePins();

  useEffect(
    // Expired session: back to the login page.
    () => startSyncEngine(syncApi, syncCatalog, { onUnauthorized: () => router.replace('/') }),
    [syncCatalog, router],
  );

  useEffect(() => localProgress.subscribeOwn(me, (progress) => useCoopStore.getState().replaceOwn(progress)), [me]);
}
