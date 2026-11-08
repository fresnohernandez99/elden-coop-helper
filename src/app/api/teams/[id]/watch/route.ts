import type { NextRequest } from 'next/server';
import { HttpError, json, withErrors } from '@/server/http';
import { createSessionToken, newSpectator, SESSION_COOKIE, sessionCookieOptions } from '@/server/session';
import { parseTeamId } from '@/server/teams';

export const dynamic = 'force-dynamic';

interface TeamParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/teams/<id>/watch — read-only session for any team, no password.
 * The team is checked when the map loads, so this does not touch the database.
 */
export const POST = withErrors(async (request: NextRequest, { params }: TeamParams) => {
  const { id } = await params;
  if (!parseTeamId(id)) throw new HttpError(404, 'This team does not exist');
  const response = json({ ok: true });
  response.cookies.set(SESSION_COOKIE, createSessionToken(newSpectator(id)), sessionCookieOptions(request));
  return response;
});
