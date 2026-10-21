import type { NextRequest } from 'next/server';
import { notFound, proxyImage } from '@/server/imageProxy';

// Hosts of the popup images referenced by pins.json (see scripts/build_pins.py).
const HOSTS: Record<string, string> = {
  jp: 'https://img.game8.jp',
  co: 'https://img.game8.co',
};
const SEGMENT = /^[A-Za-z0-9._-]+$/;

interface ImageParams {
  params: Promise<{ host: string; path: string[] }>;
}

/** GET /game8-img/<jp|co>/<path> — pin popup image from Game8, cached by the browser. */
export async function GET(request: NextRequest, { params }: ImageParams) {
  const { host, path } = await params;
  const origin = HOSTS[host];
  if (!origin || path.length === 0 || !path.every((segment) => SEGMENT.test(segment) && segment !== '..')) {
    return notFound();
  }
  return proxyImage(request, `${origin}/${path.join('/')}`);
}
