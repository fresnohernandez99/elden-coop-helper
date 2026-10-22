export type PlayerId = 'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'p6';

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

export interface Session {
  me: PlayerId;
  /** Configured player slots (those with a password), in slot order. */
  players: PlayerProfile[];
  tileUrl: string;
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
