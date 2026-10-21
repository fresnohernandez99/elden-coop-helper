import 'server-only';
import { PLAYER_IDS } from '@/config/constants';
import type { PlayerId, PlayerProfile, Session } from '@/types/domain';

const PLAYER_COLORS: Record<PlayerId, string> = { p1: '#e3b341', p2: '#4fb3bf' };
// Served by src/app/tiles (a Game8 proxy) so tiles can be cached as immutable.
const DEFAULT_TILE_URL = '/tiles/{map}/{z}_{x}_{y}.jpg';

export interface AppConfig {
  passwords: Record<PlayerId, string>;
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
  const passwords = {} as Record<PlayerId, string>;
  PLAYER_IDS.forEach((id, i) => {
    const password = env[`PLAYER${i + 1}_PASSWORD`]?.trim();
    if (!password) throw new ConfigError(`PLAYER${i + 1}_PASSWORD is missing in .env`);
    passwords[id] = password;
  });
  if (passwords.p1 === passwords.p2) {
    throw new ConfigError('Both players must have different passwords');
  }
  return {
    passwords,
    sessionSecret: env.SESSION_SECRET?.trim() ?? '',
    tileUrl: env.TILE_URL?.trim() || DEFAULT_TILE_URL,
  };
}

/** What the client may know: no passwords. */
export function sessionFor(me: PlayerId): Session {
  const players = Object.fromEntries(
    PLAYER_IDS.map((id, i) => [id, { name: `Player ${i + 1}`, color: PLAYER_COLORS[id] }]),
  ) as Record<PlayerId, PlayerProfile>;
  return { me, players, tileUrl: getConfig().tileUrl };
}
