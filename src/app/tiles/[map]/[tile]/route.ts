import type { NextRequest } from 'next/server';
import { notFound, proxyImage } from '@/server/imageProxy';

const GAME8_TILES = 'https://assets.game8.co/tools/map';
const MAP_DIR = /^[a-z0-9_]+$/;
const TILE_FILE = /^\d+_-?\d+_-?\d+\.jpg$/; // {z}_{x}_{y}.jpg

interface TileParams {
  params: Promise<{ map: string; tile: string }>;
}

/** GET /tiles/<map>/<z>_<x>_<y>.jpg — map tile from Game8, cached by the browser. */
export async function GET(request: NextRequest, { params }: TileParams) {
  const { map, tile } = await params;
  if (!MAP_DIR.test(map) || !TILE_FILE.test(tile)) return notFound();
  return proxyImage(request, `${GAME8_TILES}/${map}/${tile}`);
}
