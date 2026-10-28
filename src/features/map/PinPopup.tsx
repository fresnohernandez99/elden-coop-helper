import { useMap } from 'react-leaflet';
import { useCoopStore } from '@/features/coop/coopStore';
import { nextDestinationFromPin } from '@/features/coop/nextDestination';
import { usePlayerLabel } from '@/features/coop/playerNames';
import { parseFoundByKey, useFoundByKey, useMe, useVisiblePlayers } from '@/features/coop/selectors';
import { useUiStore } from '@/features/ui/uiStore';
import { Button } from '@/shared/ui/Button';
import { PlayerDot } from '@/shared/ui/PlayerDot';
import { assetUrl } from '@/shared/utils/assetUrl';
import type { Pin } from '@/types/domain';
import styles from './Popup.module.css';

export function PinPopup({ pin }: { pin: Pin }) {
  const map = useMap();
  const me = useMe();
  const playerLabel = usePlayerLabel();
  const players = useVisiblePlayers();
  const foundBy = parseFoundByKey(useFoundByKey(pin.id));
  const toggleFound = useCoopStore((s) => s.toggleFound);
  const setNext = useCoopStore((s) => s.setNext);
  const note = useUiStore((s) => s.nextNote);

  const foundByMe = me !== null && foundBy.includes(me);
  const next = nextDestinationFromPin(pin, note);
  const meta = [pin.category, pin.subtype, pin.region].filter(Boolean).join(' · ');

  return (
    <div className={styles.popup}>
      <header className={styles.head}>
        <img src={assetUrl(pin.icon)} alt="" />
        <div>
          <strong>{pin.title}</strong>
          <small>{meta}</small>
        </div>
      </header>

      {pin.image && <img className={styles.image} src={assetUrl(pin.image)} alt="" loading="lazy" referrerPolicy="no-referrer" />}
      {pin.description && <p>{pin.description}</p>}

      <ul className={styles.who}>
        {players.map((p) => (
          <li key={p}>
            <PlayerDot player={p} />
            {playerLabel(p)}: {foundBy.includes(p) ? <b>✓ found</b> : 'pending'}
          </li>
        ))}
      </ul>

      {me && (
        <div className={styles.actions}>
          <Button variant={foundByMe ? 'default' : 'primary'} onClick={() => toggleFound(pin.id)}>
            {foundByMe ? 'Unmark' : 'Mark as found'}
          </Button>
          {next && (
            <Button
              onClick={() => {
                setNext(next);
                map.closePopup();
              }}
            >
              Next destination
            </Button>
          )}
        </div>
      )}

      {pin.url && (
        <a href={pin.url} target="_blank" rel="noopener noreferrer">
          Game8 guide ↗
        </a>
      )}
    </div>
  );
}
