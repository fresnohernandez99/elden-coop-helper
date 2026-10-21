import type { NextRequest } from 'next/server';
import { playerForPassword } from '@/server/auth';
import { errorResponse, json, readJsonBody } from '@/server/http';
import { clientKey, loginRateLimit } from '@/server/loginRateLimit';
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from '@/server/session';

export const dynamic = 'force-dynamic';

/**
 * POST /api/login { password } → { player } and sets the session cookie.
 * The character name never reaches the server here; it travels in the sync snapshot.
 */
export async function POST(request: NextRequest) {
  try {
    const key = clientKey(request);
    if (loginRateLimit.isLimited(key)) {
      return json({ error: 'Too many attempts. Try again in a few minutes.' }, 429);
    }

    const { password } = await readJsonBody(request);
    const player = playerForPassword(typeof password === 'string' ? password : '');
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
