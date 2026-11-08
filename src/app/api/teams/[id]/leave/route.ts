import type { NextRequest } from 'next/server';
import { json, withErrors } from '@/server/http';
import { relay } from '@/server/relay';
import { getSessionViewer, SESSION_COOKIE, sessionCookieOptions } from '@/server/session';
import { leaveTeam } from '@/server/teams';

export const dynamic = 'force-dynamic';

interface TeamParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/teams/<id>/leave — a player leaves the team (their slot is freed);
 * a spectator just stops watching. Clears the session cookie either way.
 * Local progress stays in the browser.
 */
export const POST = withErrors(async (request: NextRequest, { params }: TeamParams) => {
  const { id } = await params;
  const viewer = await getSessionViewer();
  if (viewer?.kind === 'player' && viewer.teamId === id) {
    await leaveTeam(id, viewer.player, viewer.joinId);
    (await relay.loaded(id))?.removeMember(viewer.player);
  }
  const response = json({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', sessionCookieOptions(request, 0));
  return response;
});
