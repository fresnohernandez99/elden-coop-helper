import { SEARCH_MIN_LENGTH } from '@/config/constants';
import type { Pin } from '@/types/domain';

export const normalizeQuery = (query: string) => query.trim().toLowerCase();

export const isSearchActive = (query: string) => normalizeQuery(query).length >= SEARCH_MIN_LENGTH;

export function matchesSearch(pin: Pin, query: string): boolean {
  const q = normalizeQuery(query);
  if (q.length < SEARCH_MIN_LENGTH) return true;
  return [pin.title, pin.category, pin.region, pin.subtype].join(' ').toLowerCase().includes(q);
}

export interface PinFilter {
  area: string;
  categories: ReadonlySet<string>;
  search: string;
  /** Pins the current player already found that should be hidden. */
  hiddenIds?: Record<string, unknown>;
  /** Pin that is always shown (e.g. the one just focused). */
  forcedId?: string;
}

export function isPinVisible(pin: Pin, filter: PinFilter): boolean {
  if (pin.area !== filter.area || !pin.latlng) return false;
  if (pin.id === filter.forcedId) return true;
  return (
    filter.categories.has(pin.category) &&
    !(filter.hiddenIds && pin.id in filter.hiddenIds) &&
    matchesSearch(pin, filter.search)
  );
}
