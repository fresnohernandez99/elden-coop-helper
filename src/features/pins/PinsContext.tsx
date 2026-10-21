import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { createSyncCatalog, type SyncCatalog } from '@/sync/catalog';
import type { MapInfo, Pin, PinsData } from '@/types/domain';

interface PinsCatalog {
  maxZoom: number;
  maps: MapInfo[];
  pins: Pin[];
  pinsById: Map<string, Pin>;
  allCategories: string[];
  /** Compact index for the binary sync format. */
  syncCatalog: SyncCatalog;
}

const PinsContext = createContext<PinsCatalog | null>(null);

export function PinsProvider({ data, children }: { data: PinsData; children: ReactNode }) {
  const catalog = useMemo<PinsCatalog>(
    () => ({
      ...data,
      pinsById: new Map(data.pins.map((pin) => [pin.id, pin])),
      allCategories: [...new Set(data.pins.map((pin) => pin.category))],
      syncCatalog: createSyncCatalog(
        data.pins,
        data.maps.map((m) => m.title),
      ),
    }),
    [data],
  );
  return <PinsContext.Provider value={catalog}>{children}</PinsContext.Provider>;
}

export function usePins(): PinsCatalog {
  const catalog = useContext(PinsContext);
  if (!catalog) throw new Error('usePins must be used inside <PinsProvider>');
  return catalog;
}
