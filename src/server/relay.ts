import 'server-only';
import { randomInt } from 'node:crypto';
import { ONLINE_WINDOW_MS } from '@/config/constants';
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
});

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

  online(): PlayerId[] {
    const since = Date.now() - ONLINE_WINDOW_MS;
    return [...state.lastSeen].filter(([, seenAt]) => seenAt >= since).map(([player]) => player);
  },

  /** Snapshots of other players stored after `knownSeq`, or all of them if the epoch changed. */
  changesFor(player: PlayerId, epoch: number, knownSeq: number): PlayerSnapshot[] {
    const after = epoch === state.epoch ? knownSeq : 0;
    return [...state.entries]
      .filter(([id, entry]) => id !== player && entry.seq > after)
      .map(([id, entry]) => ({ player: id, rev: entry.rev, snapshot: entry.snapshot }));
  },
};
