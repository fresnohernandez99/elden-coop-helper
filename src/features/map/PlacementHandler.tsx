import { useEffect } from 'react';
import { useMapEvents } from 'react-leaflet';
import { useCoopStore } from '@/features/coop/coopStore';
import { showToast } from '@/features/notifications/toastStore';
import { useUiStore } from '@/features/ui/uiStore';
import { MAP_BOUNDS } from './mapBounds';
import styles from './MapView.module.css';

/** "Pick on map" mode: the next click sets the next destination. */
export function PlacementHandler() {
  const placing = useUiStore((s) => s.placing);
  const setPlacing = useUiStore((s) => s.setPlacing);

  const map = useMapEvents({
    click(e) {
      const ui = useUiStore.getState();
      ui.setSidebarOpen(false);
      if (!ui.placing || !ui.currentMap) return;
      if (!MAP_BOUNDS.contains(e.latlng)) {
        showToast('Pick a point inside the map');
        return;
      }
      ui.setPlacing(false);
      useCoopStore.getState().setNext({
        area: ui.currentMap,
        lat: e.latlng.lat,
        lng: e.latlng.lng,
        pinId: null,
        note: ui.nextNote,
      });
    },
  });

  useEffect(() => {
    map.getContainer().classList.toggle(styles.placing!, placing);
    if (!placing) return;
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && setPlacing(false);
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [map, placing, setPlacing]);

  return null;
}
