import { useMemo } from 'react';
import { Marker, Popup, useMap } from 'react-leaflet';
import { PLAYER_IDS } from '@/config/constants';
import { useCoopStore } from '@/features/coop/coopStore';
import { usePlayerLabel, usePlayerNames } from '@/features/coop/playerNames';
import { nextDestinationTitle, useNextDestination } from '@/features/coop/selectors';
import { usePins } from '@/features/pins/PinsContext';
import { useSession } from '@/features/session/SessionContext';
import { useUiStore } from '@/features/ui/uiStore';
import { Button } from '@/shared/ui/Button';
import type { PlayerId } from '@/types/domain';
import { flagIcon } from './mapIcons';
import styles from './Popup.module.css';
import { popupSize } from './popupSize';

/** Flags with each player's next destination on the current map. */
export function NextDestinationLayer() {
  return (
    <>
      {PLAYER_IDS.map((p) => (
        <NextDestinationMarker key={p} player={p} />
      ))}
    </>
  );
}

function NextDestinationMarker({ player }: { player: PlayerId }) {
  const name = usePlayerNames()[player];
  const next = useNextDestination(player);
  const currentMap = useUiStore((s) => s.currentMap);
  const icon = useMemo(() => flagIcon(player, name), [player, name]);

  if (!next || next.area !== currentMap) return null;

  return (
    <Marker position={[next.lat, next.lng]} icon={icon} zIndexOffset={1000}>
      <Popup {...popupSize(300, 200)}>
        <NextDestinationPopup player={player} />
      </Popup>
    </Marker>
  );
}

function NextDestinationPopup({ player }: { player: PlayerId }) {
  const map = useMap();
  const { me } = useSession();
  const { pinsById } = usePins();
  const playerLabel = usePlayerLabel();
  const next = useNextDestination(player);
  const clearNext = useCoopStore((s) => s.clearNext);

  if (!next) return null;

  return (
    <div className={styles.popup}>
      <strong>Next destination of {playerLabel(player)}</strong>
      <p>{nextDestinationTitle(next, pinsById)}</p>
      {next.note && <p className={styles.note}>“{next.note}”</p>}
      {player === me && (
        <div className={styles.actions}>
          <Button
            onClick={() => {
              map.closePopup();
              clearNext();
            }}
          >
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}
