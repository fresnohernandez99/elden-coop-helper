import { assetUrl } from '@/shared/utils/assetUrl';
import type { PinsData } from '@/types/domain';

export async function loadPins(): Promise<PinsData> {
  const res = await fetch(assetUrl('data/pins.json'));
  if (!res.ok) throw new Error(`Could not load pins.json (${res.status})`);
  return res.json();
}
