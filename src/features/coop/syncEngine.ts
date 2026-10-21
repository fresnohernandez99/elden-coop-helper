import { ApiError } from '@/api/http';
import type { SyncApi } from '@/api/syncApi';
import { POLL_INTERVAL_MS } from '@/config/constants';
import { showToast } from '@/features/notifications/toastStore';
import type { SyncCatalog } from '@/sync/catalog';
import { CatalogMismatchError, decodeSnapshot, encodeSnapshot } from '@/sync/snapshot';
import { otherPlayer, useCoopStore } from './coopStore';

const PUSH_DELAY_MS = 250; // groups several quick clicks into one request

interface SyncEngineOptions {
  /** Called when the session expired (401). */
  onUnauthorized: () => void;
}

/**
 * Keeps progress in sync with the server:
 * - Polls every POLL_INTERVAL_MS while the tab is visible.
 * - Sends your own snapshot only when the server lacks the latest revision.
 * - Receives the other player's only when it is newer than the one you have.
 *
 * Returns a function that stops it.
 */
export function startSyncEngine(api: SyncApi, catalog: SyncCatalog, { onUnauthorized }: SyncEngineOptions): () => void {
  let serverRev = 0; // your revision held by the server
  let ignoredOtherRev = 0; // the other player's revision that could not be read (another catalog)
  let running = false;
  let rerun = false;
  let stopped = false;
  let pushTimer: ReturnType<typeof setTimeout> | undefined;
  let offlineNotified = false;

  async function sync() {
    if (stopped) return;
    if (running) {
      rerun = true;
      return;
    }
    running = true;
    try {
      const { me, players } = useCoopStore.getState();
      const own = players[me];
      const response = await api.sync({
        rev: own.rev,
        knownOtherRev: Math.max(players[otherPlayer(me)].rev, ignoredOtherRev),
        snapshot: serverRev === own.rev ? null : encodeSnapshot(own, catalog),
      });
      serverRev = response.storedRev;
      offlineNotified = false;

      if (response.otherSnapshot) receiveOther(response.otherSnapshot, response.otherRev);
      // Something changed while the request was in flight: send again.
      if (useCoopStore.getState().players[me].rev !== serverRev) rerun = true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        stop();
        onUnauthorized();
        return;
      }
      if (!offlineNotified) {
        showToast(error instanceof ApiError ? error.message : 'Cannot reach the server, retrying…');
        offlineNotified = true;
      }
    } finally {
      running = false;
      if (rerun && !stopped) {
        rerun = false;
        schedulePush();
      }
    }
  }

  function receiveOther(snapshot: Uint8Array, rev: number) {
    try {
      useCoopStore.getState().receiveOther(decodeSnapshot(snapshot, catalog), rev);
    } catch (error) {
      if (!(error instanceof CatalogMismatchError)) throw error;
      ignoredOtherRev = rev;
      showToast('The other player has a different map version; ask them to reload the page');
    }
  }

  function schedulePush() {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => void sync(), PUSH_DELAY_MS);
  }

  const poll = () => {
    if (!document.hidden) void sync();
  };
  const interval = setInterval(poll, POLL_INTERVAL_MS);
  document.addEventListener('visibilitychange', poll);

  // Every local change is sent almost immediately.
  const unsubscribe = useCoopStore.subscribe((state, previous) => {
    if (state.players[state.me].rev !== previous.players[previous.me].rev) schedulePush();
  });

  function stop() {
    stopped = true;
    clearInterval(interval);
    clearTimeout(pushTimer);
    document.removeEventListener('visibilitychange', poll);
    unsubscribe();
  }

  void sync();
  return stop;
}
