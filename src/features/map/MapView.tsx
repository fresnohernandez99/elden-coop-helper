import { CRS } from 'leaflet';
import { MapContainer, ZoomControl } from 'react-leaflet';
import { MAP_MAX_ZOOM } from '@/config/constants';
import { Toast } from '@/features/notifications/Toast';
import { useUiStore } from '@/features/ui/uiStore';
import { Button } from '@/shared/ui/Button';
import { FocusController } from './FocusController';
import { MAP_BOUNDS } from './mapBounds';
import { MapTiles } from './MapTiles';
import styles from './MapView.module.css';
import { NextDestinationLayer } from './NextDestinationLayer';
import { PinLayer } from './PinLayer';
import { PlacementHandler } from './PlacementHandler';

export function MapView() {
  return (
    <main className={styles.wrap}>
      <MapContainer
        className={styles.map}
        crs={CRS.Simple}
        bounds={MAP_BOUNDS}
        maxBounds={MAP_BOUNDS.pad(0.5)}
        minZoom={0}
        maxZoom={MAP_MAX_ZOOM}
        zoomSnap={0.5}
        zoomControl={false}
        attributionControl={false}
      >
        {/* Bottom right: the top-left corner belongs to the menu button on phones. */}
        <ZoomControl position="bottomright" />
        <MapTiles />
        <PinLayer />
        <NextDestinationLayer />
        <PlacementHandler />
        <FocusController />
      </MapContainer>

      <SidebarToggle />
      <PlacementHint />
      <Toast />
    </main>
  );
}

function SidebarToggle() {
  const open = useUiStore((s) => s.sidebarOpen);
  const setOpen = useUiStore((s) => s.setSidebarOpen);
  return (
    <Button
      className={styles.sidebarToggle}
      aria-label="Open panel"
      aria-controls="sidebar"
      aria-expanded={open}
      onClick={() => setOpen(!open)}
    >
      ☰
    </Button>
  );
}

function PlacementHint() {
  const placing = useUiStore((s) => s.placing);
  const setPlacing = useUiStore((s) => s.setPlacing);
  if (!placing) return null;
  return (
    <div className={styles.hint}>
      Tap the map or a pin to set your next destination ·{' '}
      <button type="button" className={styles.link} onClick={() => setPlacing(false)}>
        cancel
      </button>
    </div>
  );
}
