import type { NextRequest } from 'next/server';
import { HttpError, json, withErrors } from '@/server/http';
import { getRoster } from '@/server/teams';

export const dynamic = 'force-dynamic';

interface TeamParams {
  params: Promise<{ id: string }>;
}

/** GET /api/teams/<id>/members — names of the players and the owner's slot (as public as the team list). */
export const GET = withErrors(async (_request: NextRequest, { params }: TeamParams) => {
  const roster = await getRoster((await params).id);
  if (!roster) throw new HttpError(404, 'This team does not exist');
  return json(roster);
});
