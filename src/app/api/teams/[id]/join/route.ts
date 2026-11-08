import type { NextRequest } from 'next/server';
import { HttpError, json, readJsonBody, withErrors } from '@/server/http';
import { clientKey, joinRateLimit } from '@/server/rateLimit';
import { relay } from '@/server/relay';
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from '@/server/session';
import { joinTeam } from '@/server/teams';

export const dynamic = 'force-dynamic';

interface TeamParams {
  params: Promise<{ id: string }>;
}

/** POST /api/teams/<id>/join { password, playerName, clientId } — joins as a player and sets the session cookie. */
export const POST = withErrors(async (request: NextRequest, { params }: TeamParams) => {
  const { id } = await params;
  const key = clientKey(request);
  if (joinRateLimit.isLimited(key)) throw new HttpError(429, 'Too many attempts. Try again in a few minutes.');
  const body = await readJsonBody(request);

  let membership;
  try {
    membership = await joinTeam(id, { password: body.password, playerName: body.playerName, clientId: body.clientId });
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) joinRateLimit.record(key);
    throw error;
  }
  joinRateLimit.reset(key);

  const { team, slot, joinId } = membership;
  (await relay.loaded(team.id))?.addMember(slot, joinId);
  const response = json({ team, slot });
  const token = createSessionToken({ kind: 'player', teamId: team.id, player: slot, joinId });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(request));
  return response;
});
