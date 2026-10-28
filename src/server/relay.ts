import 'server-only';
import { randomInt } from 'node:crypto';
import { MAX_SPECTATORS, ONLINE_WINDOW_MS } from '@/config/constants';
import type { PlayerSnapshot } from '@/sync/protocol';
import type { PlayerId } from '@/types/domain';

interface RelayEntry {
  rev: number;
  snapshot: Uint8Array;
  /** Relay sequence when it was stored; clients ask for "everything after seq N". */
  seq: number;
}

interface RelayState {
  /** Random per process: tells clients that sequences started over. */
  epoch: number;
  seq: number;
  entries: Map<PlayerId, RelayEntry>;
  lastSeen: Map<PlayerId, number>;
  /** Spectator id → last sync time. */
  spectators: Map<string, number>;
}

/**
 * Latest snapshot of each player and who is online, in memory only.
 *
 * Not the source of truth: data lives in each player's localStorage and their
 * browser re-sends it if the server loses it (restart, deploy or another
 * instance). Kept in globalThis so every route shares the same one.
 */
const globalRelay = globalThis as typeof globalThis & { __eldenCoopRelay?: RelayState };
const state = (globalRelay.__eldenCoopRelay ??= {
  epoch: randomInt(1, 2 ** 32 - 1),
  seq: 0,
  entries: new Map(),
  lastSeen: new Map(),
  spectators: new Map(),
});
state.spectators ??= new Map(); // relay created by an older version during hot reload

/** Forgets spectators that stopped syncing, so their seats free up. */
function pruneSpectators() {
  const since = Date.now() - ONLINE_WINDOW_MS;
  for (const [id, seenAt] of state.spectators) if (seenAt < since) state.spectators.delete(id);
}

export const relay = {
  get epoch() {
    return state.epoch;
  },

  get seq() {
    return state.seq;
  },

  storedRev: (player: PlayerId) => state.entries.get(player)?.rev ?? 0,

  store(player: PlayerId, rev: number, snapshot: Uint8Array) {
    state.entries.set(player, { rev, snapshot, seq: ++state.seq });
  },

  markSeen(player: PlayerId) {
    state.lastSeen.set(player, Date.now());
  },

  /** True if there is room for another spectator (best effort: counted per server instance). */
  hasSpectatorSeat(): boolean {
    pruneSpectators();
    return state.spectators.size < MAX_SPECTATORS;
  },

  /** Marks a spectator as watching. False if all seats are taken by others. */
  markSpectator(id: string): boolean {
    pruneSpectators();
    if (!state.spectators.has(id) && state.spectators.size >= MAX_SPECTATORS) return false;
    state.spectators.set(id, Date.now());
    return true;
  },

  online(): PlayerId[] {
    const since = Date.now() - ONLINE_WINDOW_MS;
    return [...state.lastSeen].filter(([, seenAt]) => seenAt >= since).map(([player]) => player);
  },

  /**
   * Snapshots of other players stored after `knownSeq`, or all of them if the epoch changed.
   * Spectators pass null and get every player.
   */
  changesFor(player: PlayerId | null, epoch: number, knownSeq: number): PlayerSnapshot[] {
    const after = epoch === state.epoch ? knownSeq : 0;
    return [...state.entries]
      .filter(([id, entry]) => id !== player && entry.seq > after)
      .map(([id, entry]) => ({ player: id, rev: entry.rev, snapshot: entry.snapshot }));
  },
};
