import { CHARACTER_NAME_MAX_LENGTH } from '@/config/constants';
import type { NextDestination, PlayerId, PlayerProgress } from '@/types/domain';

/**
 * Progress stored in this browser's localStorage.
 *
 * - Your own progress is the source of truth: only its owner changes it.
 * - The other player's is a cached copy, so it stays visible even if the
 *   server lost their snapshot while they are offline.
 */
export interface StoredProgress extends PlayerProgress {
  /** Increasing timestamp; changes on every modification. */
  rev: number;
}

const ownKey = (player: PlayerId) => `elden-coop-map.progress.${player}`;
const cacheKey = (player: PlayerId) => `elden-coop-map.cache.${player}`;
const LAST_NAME_KEY = 'elden-coop-map.last-name';

export const emptyProgress = (rev = 0): StoredProgress => ({ rev, name: '', found: {}, next: null });

/** Next revision: the current clock, but never less than or equal to the previous one. */
export const nextRev = (previous: number) => Math.max(Date.now(), previous + 1);

function isNextDestination(value: unknown): value is NextDestination {
  const next = value as NextDestination | null;
  return (
    !!next &&
    typeof next.area === 'string' &&
    typeof next.lat === 'number' &&
    typeof next.lng === 'number' &&
    typeof next.note === 'string' &&
    (next.pinId === null || typeof next.pinId === 'string')
  );
}

/** Accepts only data with the expected shape; anything else is dropped. */
export function parseStoredProgress(value: unknown): StoredProgress | null {
  const data = value as Partial<StoredProgress> | null;
  if (!data || typeof data !== 'object') return null;
  const found: Record<string, number> = {};
  if (data.found && typeof data.found === 'object') {
    for (const [id, at] of Object.entries(data.found)) found[id] = typeof at === 'number' ? at : 0;
  }
  return {
    rev: typeof data.rev === 'number' ? data.rev : 0,
    name: typeof data.name === 'string' ? data.name.slice(0, CHARACTER_NAME_MAX_LENGTH) : '',
    found,
    next: isNextDestination(data.next) ? data.next : null,
  };
}

function readItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeItem(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // No storage (private mode, quota exceeded): keep going in memory.
  }
}

function readProgress(key: string): StoredProgress | null {
  const raw = readItem(key);
  if (!raw) return null;
  try {
    return parseStoredProgress(JSON.parse(raw));
  } catch {
    return null;
  }
}

export const localProgress = {
  loadOwn: (player: PlayerId) => readProgress(ownKey(player)) ?? emptyProgress(nextRev(0)),
  saveOwn: (player: PlayerId, progress: StoredProgress) => writeItem(ownKey(player), JSON.stringify(progress)),
  loadCache: (player: PlayerId) => readProgress(cacheKey(player)) ?? emptyProgress(),
  saveCache: (player: PlayerId, progress: StoredProgress) => writeItem(cacheKey(player), JSON.stringify(progress)),

  /** Last character name typed on the login form, to prefill it. */
  loadLastName: () => readItem(LAST_NAME_KEY) ?? '',

  /** Sets the character name of your own progress (new revision if it changed). */
  setOwnName(player: PlayerId, name: string) {
    const trimmed = name.trim().slice(0, CHARACTER_NAME_MAX_LENGTH);
    writeItem(LAST_NAME_KEY, trimmed);
    const own = this.loadOwn(player);
    if (own.name !== trimmed) this.saveOwn(player, { ...own, name: trimmed, rev: nextRev(own.rev) });
  },

  /** Notifies when another tab of this browser changes your own progress. */
  subscribeOwn(player: PlayerId, onChange: (progress: StoredProgress) => void): () => void {
    const listener = (event: StorageEvent) => {
      if (event.key !== ownKey(player) || !event.newValue) return;
      try {
        const progress = parseStoredProgress(JSON.parse(event.newValue));
        if (progress) onChange(progress);
      } catch {
        // Corrupt value: ignore it.
      }
    };
    window.addEventListener('storage', listener);
    return () => window.removeEventListener('storage', listener);
  },
};
