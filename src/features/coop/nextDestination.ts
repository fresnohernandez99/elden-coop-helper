import type { NextDestination, Pin } from '@/types/domain';

/** Next destination placed exactly on a pin. */
export function nextDestinationFromPin(pin: Pin, note: string): NextDestination | null {
  if (!pin.latlng) return null;
  const [lat, lng] = pin.latlng;
  return { area: pin.area, lat, lng, pinId: pin.id, note };
}
