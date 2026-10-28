import 'server-only';
import { PLAYER_IDS } from '@/config/constants';
import type { PlayerId, PlayerProfile, Session } from '@/types/domain';

const PLAYER_COLORS: Record<PlayerId, string> = {
  p1: '#e3b341',
  p2: '#4fb3bf',
  p3: '#e07a5f',
  p4: '#a88be0',
  p5: '#7fbf6a',
  p6: '#e889b5',
};
// Served by src/app/tiles (a Game8 proxy) so tiles can be cached as immutable.
const DEFAULT_TILE_URL = '/tiles/{map}/{z}_{x}_{y}.jpg';

export interface AppConfig {
  /** Configured slots only (PLAYER<n>_PASSWORD set), in slot order. */
  players: PlayerId[];
  passwords: Partial<Record<PlayerId, string>>;
  /** Extra secret mixed into the session signing key (optional). */
  sessionSecret: string;
  tileUrl: string;
}

export class ConfigError extends Error {}

let cached: AppConfig | undefined;

/** Reads and validates the .env configuration once per process. */
export function getConfig(): AppConfig {
  cached ??= loadConfig(process.env);
  return cached;
}

function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const passwords: Partial<Record<PlayerId, string>> = {};
  PLAYER_IDS.forEach((id, i) => {
    const password = env[`PLAYER${i + 1}_PASSWORD`]?.trim();
    if (password) passwords[id] = password;
  });

  const players = PLAYER_IDS.filter((id) => passwords[id]);
  if (players.length === 0) {
    throw new ConfigError(`Set at least PLAYER1_PASSWORD in .env (up to PLAYER${PLAYER_IDS.length}_PASSWORD)`);
  }
  if (new Set(Object.values(passwords)).size !== players.length) {
    throw new ConfigError('Every player must have a different password');
  }

  return {
    players,
    passwords,
    sessionSecret: env.SESSION_SECRET?.trim() ?? '',
    tileUrl: env.TILE_URL?.trim() || DEFAULT_TILE_URL,
  };
}

export const isConfiguredPlayer = (player: PlayerId) => getConfig().players.includes(player);

/** What the client may know: no passwords. `me` is null for spectators. */
export function sessionFor(me: PlayerId | null): Session {
  const players: PlayerProfile[] = getConfig().players.map((id) => ({
    id,
    name: `Player ${PLAYER_IDS.indexOf(id) + 1}`,
    color: PLAYER_COLORS[id],
  }));
  return { me, players, tileUrl: getConfig().tileUrl };
}
