import { create } from 'zustand';
import { PLAYER_IDS } from '@/config/constants';
import { showToast } from '@/features/notifications/toastStore';
import type { NextDestination, PlayerId, PlayerProgress } from '@/types/domain';
import { emptyProgress, localProgress, nextRev, type StoredProgress } from './localProgress';

export type ImportedProgress = Pick<PlayerProgress, 'found' | 'next'>;

interface CoopStore {
  me: PlayerId;
  players: Record<PlayerId, StoredProgress>;

  initialize: (me: PlayerId) => void;
  toggleFound: (pinId: string) => void;
  setNext: (next: NextDestination) => void;
  clearNext: () => void;
  /** Adds a backup to the current progress (merges pins, takes its destination if any). */
  mergeOwn: (progress: ImportedProgress) => void;
  /** Own progress changed from another tab. */
  replaceOwn: (progress: StoredProgress) => void;
  /** The other player's progress, received from the server. */
  receiveOther: (progress: PlayerProgress, rev: number) => void;
}

export const otherPlayer = (me: PlayerId) => PLAYER_IDS.find((p) => p !== me)!;

export const useCoopStore = create<CoopStore>((set, get) => {
  /** Applies a change to your own progress and saves it to localStorage. */
  function updateOwn(change: (progress: StoredProgress) => PlayerProgress) {
    const { me, players } = get();
    const current = players[me];
    const updated: StoredProgress = { ...change(current), rev: nextRev(current.rev) };
    localProgress.saveOwn(me, updated);
    set({ players: { ...players, [me]: updated } });
  }

  return {
    me: 'p1',
    players: { p1: emptyProgress(), p2: emptyProgress() },

    initialize: (me) => {
      const other = otherPlayer(me);
      set({
        me,
        players: { [me]: localProgress.loadOwn(me), [other]: localProgress.loadCache(other) } as CoopStore['players'],
      });
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
      if (progress.rev !== players[me].rev) set({ players: { ...players, [me]: progress } });
    },

    receiveOther: (progress, rev) => {
      const { me, players } = get();
      const other = otherPlayer(me);
      if (rev <= players[other].rev) return;
      const stored = { ...progress, rev };
      localProgress.saveCache(other, stored);
      set({ players: { ...players, [other]: stored } });
    },
  };
});
