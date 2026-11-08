import type { NextRequest } from 'next/server';
import { PLAYER_IDS } from '@/config/constants';
import { HttpError, json, readJsonBody, withErrors } from '@/server/http';
import { relay } from '@/server/relay';
import { getSessionViewer } from '@/server/session';
import { kickPlayer } from '@/server/teams';
import type { PlayerId } from '@/types/domain';

export const dynamic = 'force-dynamic';

interface TeamParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/teams/<id>/kick { creatorKey, slot } — the team creator removes a
 * player and bans their browser. The creator key only travels in this request.
 */
export const POST = withErrors(async (request: NextRequest, { params }: TeamParams) => {
  const { id } = await params;
  const body = await readJsonBody(request);
  const slot = body.slot as PlayerId;
  if (!PLAYER_IDS.includes(slot)) throw new HttpError(400, 'Invalid player');

  const viewer = await getSessionViewer();
  if (viewer?.kind === 'player' && viewer.teamId === id && viewer.player === slot) {
    throw new HttpError(400, 'You cannot remove yourself; leave the team instead');
  }
  if (!(await kickPlayer(id, body.creatorKey, slot))) throw new HttpError(404, 'That player is not in the team');
  (await relay.loaded(id))?.removeMember(slot);
  return json({ ok: true });
});
