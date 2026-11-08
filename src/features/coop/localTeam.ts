import { readItem, writeItem } from './storage';

/**
 * Team data this browser keeps in localStorage.
 *
 * - `clientId`: random id of this browser, sent when joining a team so the host
 *   can ban it. Created once.
 * - Per team: its name, the password (to share it again and to rejoin with one
 *   click from the lobby) and, for the team you created, the creator key. The creator key never leaves this browser except
 *   when you kick someone; losing it means you can no longer kick.
 */
export interface LocalTeam {
  name: string;
  password?: string;
  creatorKey?: string;
}

const CLIENT_ID_KEY = 'elden-coop-map.client-id';
const TEAMS_KEY = 'elden-coop-map.teams';

function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function readTeams(): Record<string, LocalTeam> {
  try {
    const teams: unknown = JSON.parse(readItem(TEAMS_KEY) ?? '{}');
    return teams && typeof teams === 'object' && !Array.isArray(teams) ? (teams as Record<string, LocalTeam>) : {};
  } catch {
    return {};
  }
}

export const localTeam = {
  clientId(): string {
    let id = readItem(CLIENT_ID_KEY);
    if (!id) {
      id = randomId();
      writeItem(CLIENT_ID_KEY, id);
    }
    return id;
  },

  get: (teamId: string): LocalTeam | undefined => readTeams()[teamId],

  /** Merges what is known about a team (a missing field keeps its old value). */
  save(teamId: string, team: LocalTeam) {
    const teams = readTeams();
    teams[teamId] = { ...teams[teamId], ...team };
    writeItem(TEAMS_KEY, JSON.stringify(teams));
  },

  /** Teams this browser can rejoin without typing the password, by id. */
  joinable: (): [string, LocalTeam][] => Object.entries(readTeams()).filter(([, team]) => team.password),

  /** Drops the password of a team so it leaves the lobby list; a creator key is kept. */
  forget(teamId: string) {
    const teams = readTeams();
    const { creatorKey, name } = teams[teamId] ?? {};
    if (creatorKey && name) teams[teamId] = { name, creatorKey };
    else delete teams[teamId];
    writeItem(TEAMS_KEY, JSON.stringify(teams));
  },

  /** Creator keys, for the backup file. */
  creatorKeys(): Record<string, LocalTeam> {
    return Object.fromEntries(Object.entries(readTeams()).filter(([, team]) => team.creatorKey));
  },
};
