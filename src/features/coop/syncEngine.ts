import { ApiError } from '@/api/http';
import type { SyncApi } from '@/api/syncApi';
import { ONLINE_WINDOW_MS, POLL_INTERVAL_MS } from '@/config/constants';
import { showToast } from '@/features/notifications/toastStore';
import type { SyncCatalog } from '@/sync/catalog';
import type { PlayerSnapshot } from '@/sync/protocol';
import { CatalogMismatchError, decodeSnapshot, encodeSnapshot } from '@/sync/snapshot';
import type { PlayerId } from '@/types/domain';
import { ownProgress, useCoopStore } from './coopStore';

const PUSH_DELAY_MS = 250; // groups several quick clicks into one request

interface SyncEngineOptions {
  /** Configured player slots; anything else from the server is ignored. */
  players: readonly PlayerId[];
  /** Called when the session expired (401). */
  onUnauthorized: () => void;
}

/**
 * Keeps progress in sync with the server:
 * - Polls every POLL_INTERVAL_MS while the tab is visible.
 * - Sends your own snapshot only when the server lacks the latest revision.
 * - Receives only the snapshots stored since the last poll, plus who is online.
 * - Spectators (no own slot) only receive.
 *
 * Received progress is kept until a newer snapshot replaces it; a server
 * instance that does not know a player (Vercel may answer from a different one
 * on every poll) never clears it. For the same reason a player stays "online"
 * until no instance has reported them for ONLINE_WINDOW_MS.
 *
 * Returns a function that stops it.
 */
export function startSyncEngine(api: SyncApi, catalog: SyncCatalog, options: SyncEngineOptions): () => void {
  const configured = new Set(options.players);
  let epoch = 0; // server epoch, see src/sync/protocol.ts
  let knownSeq = 0; // last server sequence received
  let serverRev = 0; // your revision held by the server
  let running = false;
  let rerun = false;
  let stopped = false;
  let pushTimer: ReturnType<typeof setTimeout> | undefined;
  let offlineNotified = false;
  let mismatchNotified = false;
  const lastOnline = new Map<PlayerId, number>(); // when the server last reported each player online

  async function sync() {
    if (stopped) return;
    if (running) {
      rerun = true;
      return;
    }
    running = true;
    try {
      const { me: player } = useCoopStore.getState();
      const own = ownProgress(useCoopStore.getState());
      const response = await api.sync({
        epoch,
        knownSeq,
        rev: own.rev,
        snapshot: !player || serverRev === own.rev ? null : encodeSnapshot(own, catalog),
      });
      ({ epoch, seq: knownSeq, storedRev: serverRev } = response);
      offlineNotified = false;

      const { me, setOnline } = useCoopStore.getState();
      response.snapshots.forEach(receive);
      const now = Date.now();
      for (const p of response.online) lastOnline.set(p, now);
      setOnline(options.players.filter((p) => p !== me && now - (lastOnline.get(p) ?? 0) < ONLINE_WINDOW_MS));
      // Something changed while the request was in flight: send again.
      if (me && ownProgress(useCoopStore.getState()).rev !== serverRev) rerun = true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        stop();
        options.onUnauthorized();
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

  function receive({ player, rev, snapshot }: PlayerSnapshot) {
    if (!configured.has(player)) return;
    try {
      useCoopStore.getState().receivePlayer(player, decodeSnapshot(snapshot, catalog), rev);
    } catch (error) {
      if (!(error instanceof CatalogMismatchError)) throw error;
      if (!mismatchNotified) showToast('Another player has a different map version; ask them to reload the page');
      mismatchNotified = true;
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
    if (ownProgress(state).rev !== ownProgress(previous).rev) schedulePush();
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
