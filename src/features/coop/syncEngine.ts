import { ApiError } from '@/api/http';
import type { SyncApi } from '@/api/syncApi';
import { ONLINE_WINDOW_MS, PERSIST_INTERVAL_MS, POLL_INTERVAL_MS } from '@/config/constants';
import { showToast } from '@/features/notifications/toastStore';
import type { SyncCatalog } from '@/sync/catalog';
import { encodeSyncRequest, type PlayerSnapshot } from '@/sync/protocol';
import { CatalogMismatchError, decodeSnapshot, encodeSnapshot } from '@/sync/snapshot';
import type { PlayerId } from '@/types/domain';
import { ownProgress, useCoopStore } from './coopStore';

const PUSH_DELAY_MS = 250; // groups several quick clicks into one request

interface SyncEngineOptions {
  /** Player slots of the team; anything else from the server is ignored. */
  players: readonly PlayerId[];
  /** Called when the session is no longer valid (401): expired, kicked or left. */
  onUnauthorized: (message: string) => void;
}

/**
 * Keeps progress in sync with the server:
 * - Polls every POLL_INTERVAL_MS while the tab is visible.
 * - Sends your own snapshot only when the server lacks the latest revision.
 * - Asks the server to save it to the database at most every PERSIST_INTERVAL_MS,
 *   only when it changed since the last save, and when the tab is hidden or closed.
 * - Receives only the snapshots stored since the last poll, plus who is online.
 * - Spectators (no own slot) only receive.
 *
 * Received progress is kept until a newer snapshot replaces it; a server
 * instance that does not know a player (Vercel may answer from a different one
 * on every poll) never clears it. For the same reason a player stays "online",
 * or in the team, until no instance has reported them for ONLINE_WINDOW_MS.
 *
 * Returns a function that stops it.
 */
export function startSyncEngine(api: SyncApi, catalog: SyncCatalog, options: SyncEngineOptions): () => void {
  const configured = new Set(options.players);
  let epoch = 0; // server epoch, see src/sync/protocol.ts
  let knownSeq = 0; // last server sequence received
  let serverRev = 0; // your revision held by the server
  let persistedRev = 0; // your revision saved in the database
  let persistedAt = 0; // when a save was last requested
  let running = false;
  let rerun = false;
  let stopped = false;
  let pushTimer: ReturnType<typeof setTimeout> | undefined;
  let offlineNotified = false;
  let mismatchNotified = false;
  const lastOnline = new Map<PlayerId, number>(); // when the server last reported each player online
  const lastMember = new Map(options.players.map((p) => [p, Date.now()])); // ...and in the team

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
      const persist = !!player && own.rev !== persistedRev && Date.now() - persistedAt >= PERSIST_INTERVAL_MS;
      if (persist) persistedAt = Date.now();
      const response = await api.sync({
        epoch,
        knownSeq,
        rev: own.rev,
        snapshot: !player || serverRev === own.rev ? null : encodeSnapshot(own, catalog),
        persist,
      });
      ({ epoch, seq: knownSeq, storedRev: serverRev } = response);
      // The server holds your revision but has not saved it (e.g. a lost beacon): save it again.
      if (response.persisted) persistedRev = serverRev;
      else if (persistedRev === serverRev) persistedRev = 0;
      offlineNotified = false;

      const { me, setOnline, keepMembers } = useCoopStore.getState();
      response.snapshots.forEach(receive);
      const now = Date.now();
      const recent = (seen: Map<PlayerId, number>, p: PlayerId) => now - (seen.get(p) ?? 0) < ONLINE_WINDOW_MS;
      for (const p of response.online) lastOnline.set(p, now);
      for (const p of response.members) lastMember.set(p, now);
      setOnline(options.players.filter((p) => p !== me && recent(lastOnline, p)));
      keepMembers(options.players.filter((p) => recent(lastMember, p)));
      // Something changed while the request was in flight: send again.
      if (me && ownProgress(useCoopStore.getState()).rev !== serverRev) rerun = true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        stop();
        options.onUnauthorized(error.message);
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

  /**
   * Leaving the tab (hidden, closed or reloaded): save your progress if the last
   * save is behind. A beacon still arrives after the page is gone. It carries the
   * snapshot because it may reach an instance that does not have it.
   */
  function saveOnLeave() {
    const { me } = useCoopStore.getState();
    const own = ownProgress(useCoopStore.getState());
    if (stopped || !me || own.rev === persistedRev) return;
    const request = { epoch, knownSeq, rev: own.rev, snapshot: encodeSnapshot(own, catalog), persist: true };
    const body = new Blob([encodeSyncRequest(request) as Uint8Array<ArrayBuffer>], { type: 'application/octet-stream' });
    if (navigator.sendBeacon('/api/sync', body)) {
      persistedRev = own.rev; // optimistic: the next visible sync corrects it if it did not arrive
      persistedAt = Date.now();
    }
  }

  const poll = () => {
    if (document.hidden) saveOnLeave();
    else void sync();
  };
  const interval = setInterval(() => !document.hidden && void sync(), POLL_INTERVAL_MS);
  document.addEventListener('visibilitychange', poll);
  window.addEventListener('pagehide', saveOnLeave);

  // Every local change is sent almost immediately.
  const unsubscribe = useCoopStore.subscribe((state, previous) => {
    if (ownProgress(state).rev !== ownProgress(previous).rev) schedulePush();
  });

  function stop() {
    stopped = true;
    clearInterval(interval);
    clearTimeout(pushTimer);
    document.removeEventListener('visibilitychange', poll);
    window.removeEventListener('pagehide', saveOnLeave);
    unsubscribe();
  }

  void sync();
  return stop;
}
