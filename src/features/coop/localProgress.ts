import { CHARACTER_NAME_MAX_LENGTH } from '@/config/constants';
import type { NextDestination, PlayerId, PlayerProgress } from '@/types/domain';
import { readItem, removeItem, writeItem } from './storage';

/**
 * Progress stored in this browser's localStorage.
 *
 * - Your own progress is the source of truth: only you change it. There is one
 *   per browser, used solo and in whatever team (and slot) you play.
 * - The other players' is a cached copy per team, so it stays visible even if
 *   the server lost their snapshot while they are offline.
 */
export interface StoredProgress extends PlayerProgress {
  /** Increasing timestamp; changes on every modification. */
  rev: number;
}

const OWN_KEY = 'elden-coop-map.progress';
const cacheKey = (teamId: string, player: PlayerId) => `elden-coop-map.cache.${teamId}.${player}`;
const LAST_NAME_KEY = 'elden-coop-map.last-name';
/** Before teams, your progress was stored under the slot of a fixed password. */
const LEGACY_OWN_KEYS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map((slot) => `elden-coop-map.progress.${slot}`);

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

function readProgress(key: string): StoredProgress | null {
  const raw = readItem(key);
  if (!raw) return null;
  try {
    return parseStoredProgress(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** The old per-slot progress with the most pins, moved to the single key once. */
function migrateLegacyOwn(): StoredProgress | null {
  const legacy = LEGACY_OWN_KEYS.map(readProgress).filter((p): p is StoredProgress => !!p);
  const best = legacy.sort((a, b) => Object.keys(b.found).length - Object.keys(a.found).length || b.rev - a.rev)[0];
  if (best) writeItem(OWN_KEY, JSON.stringify(best));
  return best ?? null;
}

export const localProgress = {
  loadOwn: () => readProgress(OWN_KEY) ?? migrateLegacyOwn() ?? emptyProgress(nextRev(0)),
  saveOwn: (progress: StoredProgress) => writeItem(OWN_KEY, JSON.stringify(progress)),
  loadCache: (teamId: string, player: PlayerId) => readProgress(cacheKey(teamId, player)) ?? emptyProgress(),
  saveCache: (teamId: string, player: PlayerId, progress: StoredProgress) =>
    writeItem(cacheKey(teamId, player), JSON.stringify(progress)),
  removeCache: (teamId: string, player: PlayerId) => removeItem(cacheKey(teamId, player)),

  /** Last name typed when creating or joining a team, to prefill it. */
  loadLastName: () => readItem(LAST_NAME_KEY) ?? '',

  /** Sets the character name of your own progress (new revision if it changed). */
  setOwnName(name: string) {
    const trimmed = name.trim().slice(0, CHARACTER_NAME_MAX_LENGTH);
    writeItem(LAST_NAME_KEY, trimmed);
    const own = this.loadOwn();
    if (own.name !== trimmed) this.saveOwn({ ...own, name: trimmed, rev: nextRev(own.rev) });
  },

  /** Notifies when another tab of this browser changes your own progress. */
  subscribeOwn(onChange: (progress: StoredProgress) => void): () => void {
    const listener = (event: StorageEvent) => {
      if (event.key !== OWN_KEY || !event.newValue) return;
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
