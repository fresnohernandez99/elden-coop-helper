import type { LatLng } from 'leaflet';
import { useEffect } from 'react';
import { useMapEvents } from 'react-leaflet';
import { useCoopStore } from '@/features/coop/coopStore';
import { useMe } from '@/features/coop/selectors';
import { showToast } from '@/features/notifications/toastStore';
import { useUiStore } from '@/features/ui/uiStore';
import { MAP_BOUNDS } from './mapBounds';
import styles from './MapView.module.css';

function setNextAt(latlng: LatLng) {
  const ui = useUiStore.getState();
  if (!ui.currentMap) return;
  if (!MAP_BOUNDS.contains(latlng)) {
    showToast('Pick a point inside the map');
    return;
  }
  ui.setPlacing(false);
  useCoopStore.getState().setNext({
    area: ui.currentMap,
    lat: latlng.lat,
    lng: latlng.lng,
    pinId: null,
    note: ui.nextNote,
  });
}

/**
 * Sets the next destination on a point of the map: double-click anywhere, or a single
 * click while "pick on map" mode is on.
 */
export function PlacementHandler() {
  const me = useMe();
  const placing = useUiStore((s) => s.placing);
  const setPlacing = useUiStore((s) => s.setPlacing);

  const map = useMapEvents({
    click(e) {
      const ui = useUiStore.getState();
      ui.setSidebarOpen(false);
      if (ui.placing) setNextAt(e.latlng);
    },
    dblclick(e) {
      if (useCoopStore.getState().me) setNextAt(e.latlng);
    },
  });

  // Players use double-click for the destination; spectators keep double-click zoom.
  useEffect(() => {
    if (me) map.doubleClickZoom.disable();
    else map.doubleClickZoom.enable();
  }, [map, me]);

  useEffect(() => {
    map.getContainer().classList.toggle(styles.placing!, placing);
    if (!placing) return;
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && setPlacing(false);
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [map, placing, setPlacing]);

  return null;
}
