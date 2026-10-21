import { TileLayer } from 'react-leaflet';
import { MAP_MAX_ZOOM, MAP_SIZE } from '@/config/constants';
import { usePins } from '@/features/pins/PinsContext';
import { useSession } from '@/features/session/SessionContext';
import { useUiStore } from '@/features/ui/uiStore';
import { assetUrl } from '@/shared/utils/assetUrl';
import { MAP_BOUNDS } from './mapBounds';

export function MapTiles() {
  const { tileUrl } = useSession();
  const { maps, maxZoom } = usePins();
  const currentMap = useUiStore((s) => s.currentMap);
  const info = maps.find((m) => m.title === currentMap);
  if (!info) return null;

  return (
    <TileLayer
      // key forces a new layer when the map changes
      key={info.dir}
      url={assetUrl(tileUrl.replace('{map}', info.dir))}
      tileSize={MAP_SIZE}
      bounds={MAP_BOUNDS}
      maxNativeZoom={maxZoom}
      maxZoom={MAP_MAX_ZOOM}
      noWrap
    />
  );
}
