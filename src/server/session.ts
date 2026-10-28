import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import type { PlayerId } from '@/types/domain';
import { getConfig, isConfiguredPlayer } from './config';

/**
 * Stateless session in a signed, httpOnly cookie: `<subject>.<expires>.<signature>`.
 * The subject is a player id (`p1`) or `spectator-<random id>`.
 *
 * The signing key is derived from every password (plus SESSION_SECRET), so
 * changing a password logs everyone out.
 */

/** Who is behind a session: a player, or a read-only spectator with a random id. */
export type Viewer = { kind: 'player'; player: PlayerId } | { kind: 'spectator'; id: string };

const SPECTATOR_PREFIX = 'spectator-';

export const SESSION_COOKIE = 'ecm_session';
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function signingKey(): Buffer {
  const { players, passwords, sessionSecret } = getConfig();
  const secrets = [...players.map((id) => `${id}=${passwords[id]}`), sessionSecret];
  return createHash('sha256').update(secrets.join('\0')).digest();
}

const sign = (payload: string) => createHmac('sha256', signingKey()).update(payload).digest('base64url');

/** Token for a player, or for a new spectator when `player` is null. */
export function createSessionToken(player: PlayerId | null): string {
  const subject = player ?? SPECTATOR_PREFIX + randomBytes(9).toString('base64url');
  const expires = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const payload = `${subject}.${expires.toString(36)}`;
  return `${payload}.${sign(payload)}`;
}

function viewerFor(subject: string): Viewer | null {
  if (subject.startsWith(SPECTATOR_PREFIX)) return { kind: 'spectator', id: subject.slice(SPECTATOR_PREFIX.length) };
  return isConfiguredPlayer(subject as PlayerId) ? { kind: 'player', player: subject as PlayerId } : null;
}

/** Returns the viewer of a valid, unexpired token, or null. */
export function viewerFromSessionToken(token: string | undefined): Viewer | null {
  const [subject, expires, signature, ...extra] = token?.split('.') ?? [];
  if (!subject || !expires || !signature || extra.length > 0) return null;
  const viewer = viewerFor(subject);
  if (!viewer) return null;
  if (parseInt(expires, 36) * 1000 < Date.now()) return null;

  const expected = Buffer.from(sign(`${subject}.${expires}`));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return viewer;
}

/** Cookie options; `secure` only over HTTPS so it also works on a LAN over plain HTTP. */
export function sessionCookieOptions(request: NextRequest, maxAge = SESSION_MAX_AGE_SECONDS) {
  const https = request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';
  return { httpOnly: true, sameSite: 'lax' as const, secure: https, path: '/', maxAge };
}

/** Logged-in player or spectator in server components. */
export async function getSessionViewer(): Promise<Viewer | null> {
  return viewerFromSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}
