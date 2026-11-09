import type { NextRequest } from 'next/server';
import { json, readJsonBody, withErrors } from '@/server/http';
import { relay } from '@/server/relay';
import { getSessionViewer, SESSION_COOKIE, sessionCookieOptions } from '@/server/session';
import { leaveTeam } from '@/server/teams';

export const dynamic = 'force-dynamic';

interface TeamParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/teams/<id>/leave { creatorKey?, newOwner?, clientId? } — a player
 * leaves the team: their slot and the progress saved in it are deleted. If they
 * owned it, it goes to `newOwner` or the first remaining player. A spectator
 * just stops watching. Without a session in this team (from the lobby), the
 * browser's clientId says who leaves. Clears the session cookie if it was for this team.
 * Local progress stays in the browser.
 */
export const POST = withErrors(async (request: NextRequest, { params }: TeamParams) => {
  const { id } = await params;
  const body = await readJsonBody(request);
  const viewer = await getSessionViewer();
  const inThisTeam = viewer?.teamId === id;
  const options = { creatorKey: body.creatorKey, newOwner: body.newOwner };

  let left = null;
  if (viewer?.kind === 'player' && inThisTeam) {
    left = await leaveTeam(id, { slot: viewer.player, joinId: viewer.joinId }, options);
  } else if (body.clientId !== undefined) {
    left = await leaveTeam(id, { clientId: body.clientId }, options);
  }
  if (left) (await relay.loaded(id))?.removeMember(left);

  const response = json({ ok: true });
  if (inThisTeam || !viewer) response.cookies.set(SESSION_COOKIE, '', sessionCookieOptions(request, 0));
  return response;
});
