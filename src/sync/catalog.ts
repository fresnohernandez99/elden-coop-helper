/**
 * Compact index of the pin catalog for the binary format.
 *
 * Each pin is identified by its position in the sorted id list, so a pin takes
 * one bit (or a small number) instead of its id as text. The `hash` detects
 * when client and server use different versions of pins.json.
 */

export interface CatalogPin {
  id: string;
  area: string;
  latlng: readonly number[] | null;
}

export interface SyncCatalog {
  hash: number;
  size: number;
  areas: readonly string[];
  indexOf(pinId: string): number | undefined;
  pinAt(index: number): CatalogPin | undefined;
}

// Stable order for numeric ids ("9" < "10") as well as text ids.
const compareIds = (a: string, b: string) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);

/** 32-bit FNV-1a: fast and good enough to tell catalogs apart. */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function createSyncCatalog(pins: readonly CatalogPin[], areas: readonly string[]): SyncCatalog {
  const sorted = [...pins].sort((a, b) => compareIds(a.id, b.id));
  const indexById = new Map(sorted.map((pin, index) => [pin.id, index]));
  const hash = fnv1a(`${sorted.map((pin) => pin.id).join(',')}|${areas.join(',')}`);

  return {
    hash,
    size: sorted.length,
    areas,
    indexOf: (pinId) => indexById.get(pinId),
    pinAt: (index) => sorted[index],
  };
}
