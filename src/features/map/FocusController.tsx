import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { FOCUS_ZOOM } from '@/config/constants';
import { useUiStore } from '@/features/ui/uiStore';
import { markerRegistry } from './markerRegistry';

/** Centers the map when another part of the app asks to go to a point or pin. */
export function FocusController() {
  const map = useMap();
  const focus = useUiStore((s) => s.focus);

  useEffect(() => {
    if (!focus) return;
    map.setView(focus.latlng, Math.max(map.getZoom(), FOCUS_ZOOM));
    const { pinId } = focus;
    if (!pinId) return;
    // Wait for the marker (just mounted if it was filtered out) to be added to the map.
    const frame = requestAnimationFrame(() => markerRegistry.get(pinId)?.openPopup());
    return () => cancelAnimationFrame(frame);
  }, [focus, map]);

  return null;
}
