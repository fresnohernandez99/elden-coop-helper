import type { PlayerId, TeamInfo, TeamRoster, TeamSummary } from '@/types/domain';
import { toApiError } from './http';

export interface CreatedTeam {
  team: TeamInfo;
  slot: PlayerId;
  password: string;
  creatorKey: string;
}

async function post<T>(url: string, body: unknown = {}): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as T;
}

const teamUrl = (teamId: string, action: string) => `/api/teams/${encodeURIComponent(teamId)}/${action}`;

/** Team endpoints. Creating, joining and watching set the session cookie (httpOnly). */
export const teamsApi = {
  async list(search: string, page = 0): Promise<TeamSummary[]> {
    const params = new URLSearchParams({ search, page: String(page) });
    const res = await fetch(`/api/teams?${params}`);
    if (!res.ok) throw await toApiError(res);
    return ((await res.json()) as { teams: TeamSummary[] }).teams;
  },

  create: (name: string, playerName: string, clientId: string) =>
    post<CreatedTeam>('/api/teams', { name, playerName, clientId }),

  join: (teamId: string, password: string, playerName: string, clientId: string) =>
    post<{ team: TeamInfo; slot: PlayerId }>(teamUrl(teamId, 'join'), { password, playerName, clientId }),

  /** Read-only session for any team; no password. */
  watch: (teamId: string) => post<{ ok: true }>(teamUrl(teamId, 'watch')),

  async members(teamId: string): Promise<TeamRoster> {
    const res = await fetch(teamUrl(teamId, 'members'));
    if (!res.ok) throw await toApiError(res);
    return (await res.json()) as TeamRoster;
  },

  /** Only the team owner (by session or creator key): removes a player and bans their browser. */
  kick: (teamId: string, slot: PlayerId, creatorKey?: string) =>
    post<{ ok: true }>(teamUrl(teamId, 'kick'), { creatorKey, slot }),

  /** Only the team owner: hands the team over to another member. */
  transfer: (teamId: string, slot: PlayerId, creatorKey?: string) =>
    post<{ ok: true }>(teamUrl(teamId, 'owner'), { creatorKey, slot }),

  /**
   * Leaves the team (your slot and its saved progress are deleted) and ends the
   * session. An owner hands the team to `newOwner`. From the lobby, `clientId` says who leaves.
   */
  leave: (teamId: string, options: { creatorKey?: string; newOwner?: PlayerId; clientId?: string } = {}) =>
    post<{ ok: true }>(teamUrl(teamId, 'leave'), options),
};
