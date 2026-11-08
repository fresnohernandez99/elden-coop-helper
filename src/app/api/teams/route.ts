import type { NextRequest } from 'next/server';
import { HttpError, json, readJsonBody, withErrors } from '@/server/http';
import { clientKey, createTeamRateLimit } from '@/server/rateLimit';
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from '@/server/session';
import { createTeam, listTeams } from '@/server/teams';

export const dynamic = 'force-dynamic';

/** GET /api/teams?search=&page= — teams for the lobby, most recently active first. */
export const GET = withErrors(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  return json({ teams: await listTeams({ search: params.get('search'), page: params.get('page') }) });
});

/**
 * POST /api/teams { name, playerName, clientId } — creates a team with you in it.
 * Returns its password (to share) and the creator key (kept by this browser
 * only), and sets the session cookie.
 */
export const POST = withErrors(async (request: NextRequest) => {
  const key = clientKey(request);
  if (createTeamRateLimit.isLimited(key)) throw new HttpError(429, 'Too many new teams. Try again later.');
  const body = await readJsonBody(request);
  const created = await createTeam({ name: body.name, playerName: body.playerName, clientId: body.clientId });
  createTeamRateLimit.record(key);

  const { team, slot, joinId, password, creatorKey } = created;
  const response = json({ team, slot, password, creatorKey });
  const token = createSessionToken({ kind: 'player', teamId: team.id, player: slot, joinId });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(request));
  return response;
});
