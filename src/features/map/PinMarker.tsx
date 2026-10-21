import type { LeafletMouseEvent, Marker as LeafletMarker } from 'leaflet';
import { memo, useCallback, useMemo } from 'react';
import { Marker, Popup } from 'react-leaflet';
import { useCoopStore } from '@/features/coop/coopStore';
import { nextDestinationFromPin } from '@/features/coop/nextDestination';
import { parseFoundByKey, useFoundByKey, useMe } from '@/features/coop/selectors';
import { useUiStore } from '@/features/ui/uiStore';
import type { Pin } from '@/types/domain';
import { pinIcon } from './mapIcons';
import { markerRegistry } from './markerRegistry';
import { PinPopup } from './PinPopup';
import { popupSize } from './popupSize';

export const PinMarker = memo(function PinMarker({ pin }: { pin: Pin }) {
  const me = useMe();
  const foundByKey = useFoundByKey(pin.id);
  const icon = useMemo(() => {
    const foundBy = parseFoundByKey(foundByKey);
    return pinIcon(pin.icon, foundBy, foundBy.includes(me));
  }, [pin.icon, foundByKey, me]);

  const registerMarker = useCallback((marker: LeafletMarker | null) => markerRegistry.register(pin.id, marker), [pin.id]);

  const eventHandlers = useMemo(
    () => ({
      // In "pick on map" mode, clicking a pin sets it as the destination.
      click: (e: LeafletMouseEvent) => {
        const ui = useUiStore.getState();
        const next = nextDestinationFromPin(pin, ui.nextNote);
        if (!ui.placing || !next) return;
        const marker = e.target as LeafletMarker;
        setTimeout(() => marker.closePopup()); // the popup opens on the same click
        ui.setPlacing(false);
        useCoopStore.getState().setNext(next);
      },
    }),
    [pin],
  );

  if (!pin.latlng) return null;

  return (
    <Marker
      ref={registerMarker}
      position={pin.latlng}
      icon={icon}
      title={pin.title}
      riseOnHover
      eventHandlers={eventHandlers}
    >
      <Popup {...popupSize(300, 240)}>
        <PinPopup pin={pin} />
      </Popup>
    </Marker>
  );
});
