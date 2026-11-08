import 'server-only';
import { type NextRequest, NextResponse } from 'next/server';
import { DecodeError } from '@/sync/binary';
import { CatalogMismatchError } from '@/sync/snapshot';
import { ConfigError } from './config';
import { HttpError } from './errors';
import { createSessionToken, readSessionToken, SESSION_COOKIE, sessionCookieOptions, type Viewer } from './session';

export { HttpError };

const NO_STORE = { 'Cache-Control': 'no-store' };

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: NO_STORE });

export const binary = (bytes: Uint8Array) =>
  new Response(bytes as Uint8Array<ArrayBuffer>, {
    headers: { ...NO_STORE, 'Content-Type': 'application/octet-stream' },
  });

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) return json({ error: error.message }, error.status);
  if (error instanceof CatalogMismatchError) return json({ error: error.message }, 409);
  if (error instanceof DecodeError) return json({ error: `Invalid message: ${error.message}` }, 400);
  if (error instanceof ConfigError) return json({ error: `Incomplete configuration: ${error.message}` }, 500);
  console.error(error);
  return json({ error: 'Internal error' }, 500);
}

/** Wraps a route handler so thrown errors become JSON responses. */
export function withErrors<Context>(handler: (request: NextRequest, context: Context) => Promise<Response>) {
  return async (request: NextRequest, context: Context): Promise<Response> => {
    try {
      return await handler(request, context);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

type ViewerHandler = (request: NextRequest, viewer: Viewer) => Promise<Response>;

/**
 * Wraps a route handler: requires a team session cookie (player or spectator) and turns errors into JSON.
 * A successful request with a session older than a day gets it renewed.
 */
export function withViewer(handler: ViewerHandler) {
  return async (request: NextRequest): Promise<Response> => {
    try {
      const session = readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
      if (!session) throw new HttpError(401, 'Not in a team');
      const response = await handler(request, session.viewer);
      if (!session.renew || !response.ok) return response;
      const renewed = new NextResponse(response.body, response);
      renewed.cookies.set(SESSION_COOKIE, createSessionToken(session.viewer), sessionCookieOptions(request));
      return renewed;
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Invalid JSON');
  }
  return body as Record<string, unknown>;
}

/** Reads a binary body, rejecting anything larger than `maxBytes`. */
export async function readBinaryBody(request: Request, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(request.headers.get('content-length'));
  if (declared > maxBytes) throw new HttpError(413, 'Message too large');
  const body = new Uint8Array(await request.arrayBuffer());
  if (body.length > maxBytes) throw new HttpError(413, 'Message too large');
  return body;
}
