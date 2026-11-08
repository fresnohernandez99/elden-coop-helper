import 'server-only';
import type { NextRequest } from 'next/server';

/**
 * Proxies Game8 map images through our own origin.
 *
 * Game8 serves them without Cache-Control, so browsers only cache them
 * heuristically. Returning them from here as `immutable` means each tile is
 * downloaded once and then served from the browser cache, even across visits.
 * Only paths with the expected format reach Game8, and only requests made by
 * our own pages are served (modern browsers send `Sec-Fetch-Site`), so other sites
 * cannot hotlink through it. Solo play has no session, so none is required.
 */

// Private: only this browser caches it.
const CACHE_FOREVER = 'private, max-age=31536000, immutable';
const CACHE_MISSING = 'private, max-age=3600';

export async function proxyImage(request: NextRequest, upstreamUrl: string): Promise<Response> {
  // Old browsers do not send the header; they are let through.
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin') return new Response('Forbidden', { status: 403 });

  const upstream = await fetch(upstreamUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
  if (!upstream.ok) {
    // Game8 answers 403 for tiles outside the map; cache that briefly too.
    return new Response(null, { status: 404, headers: { 'Cache-Control': CACHE_MISSING } });
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream',
      'Cache-Control': CACHE_FOREVER,
      ...(upstream.headers.get('content-length') && { 'Content-Length': upstream.headers.get('content-length')! }),
    },
  });
}

export const notFound = () => new Response(null, { status: 404 });
