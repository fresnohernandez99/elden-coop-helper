import type { NextRequest } from 'next/server';
import { playerForPassword } from '@/server/auth';
import { errorResponse, json, readJsonBody } from '@/server/http';
import { relay } from '@/server/relay';
import { clientKey, loginRateLimit } from '@/server/loginRateLimit';
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from '@/server/session';

export const dynamic = 'force-dynamic';

/**
 * POST /api/login { password } → { player } and sets the session cookie.
 * POST /api/login { spectator: true } → { player: null }: a read-only session,
 * no password needed, while there are free spectator seats.
 * The character name never reaches the server here; it travels in the sync snapshot.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody(request);
    if (body.spectator === true) {
      if (!relay.hasSpectatorSeat()) return json({ error: 'Spectator room is full. Try again in a moment.' }, 503);
      const response = json({ player: null });
      response.cookies.set(SESSION_COOKIE, createSessionToken(null), sessionCookieOptions(request));
      return response;
    }

    const key = clientKey(request);
    if (loginRateLimit.isLimited(key)) {
      return json({ error: 'Too many attempts. Try again in a few minutes.' }, 429);
    }

    const player = playerForPassword(typeof body.password === 'string' ? body.password : '');
    if (!player) {
      loginRateLimit.recordFailure(key);
      return json({ error: 'Wrong password' }, 401);
    }

    loginRateLimit.reset(key);
    const response = json({ player });
    response.cookies.set(SESSION_COOKIE, createSessionToken(player), sessionCookieOptions(request));
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
