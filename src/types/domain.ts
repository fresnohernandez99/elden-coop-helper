export type PlayerId = 'p1' | 'p2' | 'p3';

export type LatLng = [lat: number, lng: number];

// --- Pin catalog (public/data/pins.json) ---------------------------------------

export interface MapInfo {
  title: string;
  /** Tile folder on the CDN. */
  dir: string;
}

export interface Pin {
  id: string;
  title: string;
  description: string;
  url: string;
  /** Title of the map it belongs to, or '' if it has no location. */
  area: string;
  category: string;
  region: string;
  subtype: string;
  icon: string;
  image: string;
  latlng: LatLng | null;
}

export interface PinsData {
  maxZoom: number;
  maps: MapInfo[];
  pins: Pin[];
}

// --- Session and progress --------------------------------------------------------

export interface PlayerProfile {
  id: PlayerId;
  /** Fallback name, shown until the player picks a character name. */
  name: string;
  color: string;
}

export interface TeamInfo {
  id: string;
  name: string;
}

export interface Session {
  /** Your player slot, or null when watching as a spectator (read-only). Solo play uses p1. */
  me: PlayerId | null;
  /** Player slots shown in the UI, in slot order (only p1 when playing solo). */
  players: PlayerProfile[];
  /** The team you play in or watch; null when playing solo (nothing is synced). */
  team: TeamInfo | null;
  tileUrl: string;
}

/** Who is in a team and who owns it (removes players and can hand the team over). */
export interface TeamRoster {
  members: { slot: PlayerId; name: string }[];
  /** null when the owner is unknown (a team from before ownership could be passed on) or left. */
  owner: PlayerId | null;
}

/** A team as listed in the lobby. */
export interface TeamSummary extends TeamInfo {
  players: string[];
}

export interface NextDestination {
  area: string;
  lat: number;
  lng: number;
  note: string;
  pinId: string | null;
}

export interface PlayerProgress {
  /** Character name the player logged in with ('' if not set yet). */
  name: string;
  /** pinId → when it was marked (seconds; 0 when received from the other player). */
  found: Record<string, number>;
  next: NextDestination | null;
}
