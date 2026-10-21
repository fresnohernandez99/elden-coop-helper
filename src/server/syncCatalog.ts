import 'server-only';
import pinsData from '../../public/data/pins.json';
import { createSyncCatalog } from '@/sync/catalog';

// pins.json is bundled into the server so it also works without a filesystem (Vercel).
export const syncCatalog = createSyncCatalog(
  pinsData.pins,
  pinsData.maps.map((map) => map.title),
);
