import type { PlayerId } from '@/types/domain';

// Shared by client and server: do not import Leaflet here.

export const PLAYER_IDS: readonly PlayerId[] = ['p1', 'p2'];

/** Pin coordinates range from 0 to 256, matching the zoom-0 tile. */
export const MAP_SIZE = 256;
export const MAP_MAX_ZOOM = 7;
export const FOCUS_ZOOM = 4;

export const POLL_INTERVAL_MS = 3000;
export const NOTE_MAX_LENGTH = 140;
export const CHARACTER_NAME_MAX_LENGTH = 32;
export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_RESULTS = 40;
