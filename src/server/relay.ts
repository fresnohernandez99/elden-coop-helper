import 'server-only';
import type { PlayerId } from '@/types/domain';

export interface RelayEntry {
  rev: number;
  snapshot: Uint8Array;
}

/**
 * Latest snapshot of each player, in memory only.
 *
 * Not the source of truth: data lives in each player's localStorage and their
 * browser re-sends it if the server loses it (restart, deploy or another
 * instance). Kept in globalThis so every route shares the same one.
 */
const globalRelay = globalThis as typeof globalThis & { __eldenCoopRelay?: Map<PlayerId, RelayEntry> };
const entries = (globalRelay.__eldenCoopRelay ??= new Map());

export const relay = {
  get: (player: PlayerId) => entries.get(player),
  set: (player: PlayerId, entry: RelayEntry) => entries.set(player, entry),
};
