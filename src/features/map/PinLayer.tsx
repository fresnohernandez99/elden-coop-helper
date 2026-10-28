import { useMemo } from 'react';
import { useCoopStore } from '@/features/coop/coopStore';
import { isPinVisible } from '@/features/pins/filters';
import { usePins } from '@/features/pins/PinsContext';
import { useEnabledCategories } from '@/features/pins/useEnabledCategories';
import { useUiStore } from '@/features/ui/uiStore';
import { PinMarker } from './PinMarker';

/** Pins of the current map that pass the sidebar filters. */
export function PinLayer() {
  const { pins } = usePins();
  const categories = useEnabledCategories();
  const currentMap = useUiStore((s) => s.currentMap);
  const search = useUiStore((s) => s.search);
  const hideFound = useUiStore((s) => s.hideFound);
  const focusedPinId = useUiStore((s) => s.focus?.pinId);
  // Only depends on what I found when hiding found pins.
  const hiddenIds = useCoopStore((s) => (hideFound && s.me ? s.players[s.me]?.found : undefined));

  const visiblePins = useMemo(() => {
    if (!currentMap) return [];
    const filter = { area: currentMap, categories, search, hiddenIds, forcedId: focusedPinId };
    return pins.filter((pin) => isPinVisible(pin, filter));
  }, [pins, currentMap, categories, search, hiddenIds, focusedPinId]);

  return (
    <>
      {visiblePins.map((pin) => (
        <PinMarker key={pin.id} pin={pin} />
      ))}
    </>
  );
}
