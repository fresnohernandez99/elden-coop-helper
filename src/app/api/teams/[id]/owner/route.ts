import type { NextRequest } from 'next/server';
import { PLAYER_IDS } from '@/config/constants';
import { HttpError, json, readJsonBody, withErrors } from '@/server/http';
import { getSessionViewer } from '@/server/session';
import { transferOwnership } from '@/server/teams';
import type { PlayerId } from '@/types/domain';

export const dynamic = 'force-dynamic';

interface TeamParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/teams/<id>/owner { creatorKey?, slot } — the team owner hands the
 * team over to another member. The creator key stops working after this.
 */
export const POST = withErrors(async (request: NextRequest, { params }: TeamParams) => {
  const { id } = await params;
  const body = await readJsonBody(request);
  const slot = body.slot as PlayerId;
  if (!PLAYER_IDS.includes(slot)) throw new HttpError(400, 'Invalid player');

  const viewer = await getSessionViewer();
  const joinId = viewer?.kind === 'player' && viewer.teamId === id ? viewer.joinId : undefined;
  await transferOwnership(id, { joinId, creatorKey: body.creatorKey }, slot);
  return json({ ok: true });
});
