import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { PLAYER_IDS } from '@/config/constants';
import type { PlayerId } from '@/types/domain';
import { getConfig } from './config';

/**
 * Stateless session in a signed, httpOnly cookie: `<subject>.<expires>.<signature>`.
 * The subject is `p:<team id>:<slot>:<join id>` for a player or
 * `s:<team id>:<random id>` for a spectator. Without a cookie you play solo.
 *
 * The join id changes when a player is kicked and someone else takes the slot,
 * so an old cookie stops working (see relay.ts for how that is checked).
 * Changing SESSION_SECRET logs everyone out.
 */

/** Who is behind a session: a team player, or a read-only spectator of a team. */
export type Viewer =
  | { kind: 'player'; teamId: string; player: PlayerId; joinId: string }
  | { kind: 'spectator'; teamId: string; id: string };

export const SESSION_COOKIE = 'ecm_session';
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const TEAM_ID = /^[0-9a-f]{24}$/;
const TOKEN = /^[A-Za-z0-9_-]{8,32}$/;

const signingKey = () => createHash('sha256').update(`session\0${getConfig().sessionSecret}`).digest();

const sign = (payload: string) => createHmac('sha256', signingKey()).update(payload).digest('base64url');

function subjectOf(viewer: Viewer): string {
  return viewer.kind === 'player'
    ? `p:${viewer.teamId}:${viewer.player}:${viewer.joinId}`
    : `s:${viewer.teamId}:${viewer.id}`;
}

function viewerFor(subject: string): Viewer | null {
  const [kind, teamId = '', ...rest] = subject.split(':');
  if (!TEAM_ID.test(teamId)) return null;
  if (kind === 'p' && rest.length === 2) {
    const [player, joinId = ''] = rest as [PlayerId, string];
    return PLAYER_IDS.includes(player) && TOKEN.test(joinId) ? { kind: 'player', teamId, player, joinId } : null;
  }
  if (kind === 's' && rest.length === 1 && TOKEN.test(rest[0]!)) return { kind: 'spectator', teamId, id: rest[0]! };
  return null;
}

/** A new spectator of a team, with a random id that holds their seat. */
export const newSpectator = (teamId: string): Viewer => ({
  kind: 'spectator',
  teamId,
  id: randomBytes(9).toString('base64url'),
});

export function createSessionToken(viewer: Viewer): string {
  const expires = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const payload = `${subjectOf(viewer)}.${expires.toString(36)}`;
  return `${payload}.${sign(payload)}`;
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

/** Team player or spectator in server components; null when there is no team session. */
export async function getSessionViewer(): Promise<Viewer | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? viewerFromSessionToken(token) : null;
}
