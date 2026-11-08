import 'server-only';
import { PLAYER_IDS } from '@/config/constants';
import type { PlayerId, PlayerProfile, Session, TeamInfo } from '@/types/domain';

const PLAYER_COLORS: Record<PlayerId, string> = {
  p1: '#e3b341',
  p2: '#4fb3bf',
  p3: '#e07a5f',
};
// Served by src/app/tiles (a Game8 proxy) so tiles can be cached as immutable.
const DEFAULT_TILE_URL = '/tiles/{map}/{z}_{x}_{y}.jpg';
const DEFAULT_DB = 'eldencoop';
const MIN_SECRET_LENGTH = 16;

export interface AppConfig {
  /** Signs the session cookies. */
  sessionSecret: string;
  mongodbUri: string;
  mongodbDb: string;
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
  const sessionSecret = env.SESSION_SECRET?.trim() ?? '';
  if (sessionSecret.length < MIN_SECRET_LENGTH) {
    throw new ConfigError(`Set SESSION_SECRET in .env (at least ${MIN_SECRET_LENGTH} characters)`);
  }
  const mongodbUri = env.MONGODB_URI?.trim() ?? '';
  if (!mongodbUri) throw new ConfigError('Set MONGODB_URI in .env');

  return {
    sessionSecret,
    mongodbUri,
    mongodbDb: env.MONGODB_DB?.trim() || DEFAULT_DB,
    tileUrl: env.TILE_URL?.trim() || DEFAULT_TILE_URL,
  };
}

/** The tile URL alone: solo play needs no database or secret. */
export const tileUrl = () => process.env.TILE_URL?.trim() || DEFAULT_TILE_URL;

const profile = (id: PlayerId, name?: string): PlayerProfile => ({
  id,
  name: name || `Player ${PLAYER_IDS.indexOf(id) + 1}`,
  color: PLAYER_COLORS[id],
});

/**
 * What the client may know about a team session. `me` is null for spectators.
 * `names` are the names players joined with, used until their snapshot arrives.
 */
export function teamSessionFor(team: TeamInfo, me: PlayerId | null, names: Partial<Record<PlayerId, string>>): Session {
  return { me, players: PLAYER_IDS.map((id) => profile(id, names[id])), team, tileUrl: tileUrl() };
}

/** Solo play: one player, nothing synced. */
export const soloSession = (): Session => ({ me: 'p1', players: [profile('p1')], team: null, tileUrl: tileUrl() });
