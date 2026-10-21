import type { NextRequest } from 'next/server';
import { json } from '@/server/http';
import { SESSION_COOKIE, sessionCookieOptions } from '@/server/session';

export const dynamic = 'force-dynamic';

/** POST /api/logout — clears the session cookie. Local progress stays in the browser. */
export async function POST(request: NextRequest) {
  const response = json({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', sessionCookieOptions(request, 0));
  return response;
}
