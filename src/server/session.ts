import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { PLAYER_IDS } from '@/config/constants';
import type { PlayerId } from '@/types/domain';
import { getConfig } from './config';

/**
 * Stateless session in a signed, httpOnly cookie: `<player>.<expires>.<signature>`.
 *
 * The signing key is derived from both passwords (plus SESSION_SECRET), so
 * changing a password logs everyone out.
 */

export const SESSION_COOKIE = 'ecm_session';
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function signingKey(): Buffer {
  const { passwords, sessionSecret } = getConfig();
  return createHash('sha256').update([passwords.p1, passwords.p2, sessionSecret].join('\0')).digest();
}

const sign = (payload: string) => createHmac('sha256', signingKey()).update(payload).digest('base64url');

export function createSessionToken(player: PlayerId): string {
  const expires = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const payload = `${player}.${expires.toString(36)}`;
  return `${payload}.${sign(payload)}`;
}

/** Returns the player of a valid, unexpired token, or null. */
export function playerFromSessionToken(token: string | undefined): PlayerId | null {
  const [player, expires, signature, ...extra] = token?.split('.') ?? [];
  if (!player || !expires || !signature || extra.length > 0) return null;
  if (!PLAYER_IDS.includes(player as PlayerId)) return null;
  if (parseInt(expires, 36) * 1000 < Date.now()) return null;

  const expected = Buffer.from(sign(`${player}.${expires}`));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return player as PlayerId;
}

/** Cookie options; `secure` only over HTTPS so it also works on a LAN over plain HTTP. */
export function sessionCookieOptions(request: NextRequest, maxAge = SESSION_MAX_AGE_SECONDS) {
  const https = request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';
  return { httpOnly: true, sameSite: 'lax' as const, secure: https, path: '/', maxAge };
}

/** Logged-in player in server components. */
export async function getSessionPlayer(): Promise<PlayerId | null> {
  return playerFromSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}
