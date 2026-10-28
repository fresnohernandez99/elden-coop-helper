import { create } from 'zustand';
import { showToast } from '@/features/notifications/toastStore';
import type { NextDestination, PlayerId, PlayerProgress } from '@/types/domain';
import { emptyProgress, localProgress, nextRev, type StoredProgress } from './localProgress';

export type ImportedProgress = Pick<PlayerProgress, 'found' | 'next'>;

interface CoopStore {
  /** Your player slot, or null for a spectator (read-only: every change is ignored). */
  me: PlayerId | null;
  /**
   * Your own progress plus the last received progress of the other configured
   * players. Another player's entry is only replaced by a newer snapshot, never
   * cleared, so it stays visible after they disconnect.
   */
  players: Partial<Record<PlayerId, StoredProgress>>;
  /** Other players online right now, in slot order. */
  online: PlayerId[];

  initialize: (me: PlayerId | null, playerIds: readonly PlayerId[]) => void;
  toggleFound: (pinId: string) => void;
  setNext: (next: NextDestination) => void;
  clearNext: () => void;
  /** Adds a backup to the current progress (merges pins, takes its destination if any). */
  mergeOwn: (progress: ImportedProgress) => void;
  /** Own progress changed from another tab. */
  replaceOwn: (progress: StoredProgress) => void;
  /** Another player's progress, received from the server. Ignored if not newer. */
  receivePlayer: (player: PlayerId, progress: PlayerProgress, rev: number) => void;
  setOnline: (players: PlayerId[]) => void;
}

/** Your own progress; always present once the store is initialized (empty for a spectator). */
export const ownProgress = (state: Pick<CoopStore, 'me' | 'players'>) =>
  (state.me && state.players[state.me]) || emptyProgress();

export const useCoopStore = create<CoopStore>((set, get) => {
  /** Applies a change to your own progress and saves it to localStorage. */
  function updateOwn(change: (progress: StoredProgress) => PlayerProgress) {
    const { me, players } = get();
    if (!me) return;
    const current = ownProgress(get());
    const updated: StoredProgress = { ...change(current), rev: nextRev(current.rev) };
    localProgress.saveOwn(me, updated);
    set({ players: { ...players, [me]: updated } });
  }

  return {
    me: 'p1',
    players: {},
    online: [],

    initialize: (me, playerIds) => {
      const players: CoopStore['players'] = {};
      for (const id of playerIds) players[id] = id === me ? localProgress.loadOwn(id) : localProgress.loadCache(id);
      set({ me, players, online: [] });
    },

    toggleFound: (pinId) =>
      updateOwn((progress) => {
        const { [pinId]: foundAt, ...rest } = progress.found;
        return { ...progress, found: foundAt === undefined ? { ...rest, [pinId]: Math.floor(Date.now() / 1000) } : rest };
      }),

    setNext: (next) => {
      updateOwn((progress) => ({ ...progress, next }));
      showToast('Next destination saved');
    },

    clearNext: () => updateOwn((progress) => ({ ...progress, next: null })),

    mergeOwn: (imported) =>
      updateOwn((progress) => ({
        ...progress,
        found: { ...imported.found, ...progress.found },
        next: imported.next ?? progress.next,
      })),

    replaceOwn: (progress) => {
      const { me, players } = get();
      if (me && progress.rev !== players[me]?.rev) set({ players: { ...players, [me]: progress } });
    },

    receivePlayer: (player, progress, rev) => {
      const { me, players } = get();
      if (player === me || rev <= (players[player]?.rev ?? 0)) return;
      const stored = { ...progress, rev };
      localProgress.saveCache(player, stored);
      set({ players: { ...players, [player]: stored } });
    },

    setOnline: (online) => {
      if (online.join() !== get().online.join()) set({ online });
    },
  };
});
