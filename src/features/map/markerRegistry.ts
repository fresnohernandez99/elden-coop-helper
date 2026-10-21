import type { Marker } from 'leaflet';

/**
 * Mounted pin markers by id. Lets code outside the map (search, destination
 * panel) open a pin's popup.
 */
const markers = new Map<string, Marker>();

export const markerRegistry = {
  register(pinId: string, marker: Marker | null) {
    if (marker) markers.set(pinId, marker);
    else markers.delete(pinId);
  },
  get: (pinId: string) => markers.get(pinId),
};
