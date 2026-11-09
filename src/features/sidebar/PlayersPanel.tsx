import { useMemo } from 'react';
import { NOTE_MAX_LENGTH } from '@/config/constants';
import { useCoopStore } from '@/features/coop/coopStore';
import { usePlayerLabel } from '@/features/coop/playerNames';
import {
  countFound,
  nextDestinationTitle,
  useFoundMap,
  useIsOnline,
  useNextDestination,
  useOnlineCount,
  useVisiblePlayers,
} from '@/features/coop/selectors';
import { usePins } from '@/features/pins/PinsContext';
import { useEnabledCategories } from '@/features/pins/useEnabledCategories';
import { useSession } from '@/features/session/SessionContext';
import { useUiStore } from '@/features/ui/uiStore';
import { Button } from '@/shared/ui/Button';
import { PlayerDot } from '@/shared/ui/PlayerDot';
import { Section } from '@/shared/ui/Section';
import type { Pin, PlayerId } from '@/types/domain';
import styles from './PlayersPanel.module.css';

/**
 * You and every player whose progress was received: progress and next
 * destination in one card each. Offline players keep their last known data.
 * Progress only counts the categories that are shown on the map.
 */
export function PlayersPanel() {
  const { me, team } = useSession();
  const { pins: allPins } = usePins();
  const enabled = useEnabledCategories();
  const currentMap = useUiStore((s) => s.currentMap);
  const players = useVisiblePlayers();
  const onlineCount = useOnlineCount();
  const pins = useMemo(() => allPins.filter((pin) => enabled.has(pin.category)), [allPins, enabled]);
  const pinsOnMap = useMemo(() => pins.filter((pin) => pin.area === currentMap), [pins, currentMap]);
  const others = players.filter((p) => p !== me);

  return (
    <Section title="Players" actions={team && <small className={styles.muted}>{onlineCount} online</small>}>
      {players.map((p) => (
        <PlayerCard key={p} player={p} pins={pins} pinsOnMap={pinsOnMap} mapTitle={currentMap ?? ''} />
      ))}
      {team && others.length === 0 && (
        <p className={styles.empty}>No progress from {me ? 'other ' : ''}players yet</p>
      )}
      {me && <NextDestinationForm />}
    </Section>
  );
}

interface PlayerCardProps {
  player: PlayerId;
  pins: Pin[];
  pinsOnMap: Pin[];
  mapTitle: string;
}

function PlayerCard({ player, pins, pinsOnMap, mapTitle }: PlayerCardProps) {
  const { me } = useSession();
  const { pinsById } = usePins();
  const playerLabel = usePlayerLabel();
  const found = useFoundMap(player);
  const next = useNextDestination(player);
  const clearNext = useCoopStore((s) => s.clearNext);
  const focusOn = useUiStore((s) => s.focusOn);
  const online = useIsOnline(player);

  const total = useMemo(() => countFound(pins, found), [pins, found]);
  const onMap = useMemo(() => countFound(pinsOnMap, found), [pinsOnMap, found]);
  const percent = toPercent(total, pins.length);

  return (
    <article className={styles.card} style={{ borderColor: `var(--${player})` }}>
      <header className={styles.line}>
        <strong>
          <PlayerDot player={player} />
          {playerLabel(player)}
          {!online && <small className={styles.muted}> · offline</small>}
        </strong>
        <span className={styles.count}>
          {total} / {pins.length} <span className={styles.muted}>· {formatPercent(percent)}</span>
        </span>
      </header>
      <div className={styles.bar}>
        <span style={{ width: `${percent.toFixed(1)}%`, background: `var(--${player})` }} />
      </div>
      <small className={styles.muted}>
        {mapTitle}: {onMap} / {pinsOnMap.length} · {formatPercent(toPercent(onMap, pinsOnMap.length))}
      </small>

      <div className={styles.destination}>
        {next ? (
          <>
            <span className={styles.destinationTitle}>
              → {nextDestinationTitle(next, pinsById)} <small className={styles.muted}>· {next.area}</small>
            </span>
            <span className={styles.actions}>
              <Button size="small" onClick={() => focusOn(next.area, [next.lat, next.lng])}>
                View
              </Button>
              {player === me && (
                <Button size="small" onClick={clearNext}>
                  Remove
                </Button>
              )}
            </span>
          </>
        ) : (
          <span className={styles.muted}>No next destination</span>
        )}
      </div>
      {next?.note && <div className={styles.note}>“{next.note}”</div>}
    </article>
  );
}

const toPercent = (part: number, whole: number) => (whole ? (part / whole) * 100 : 0);

/** Rounded down, so 100% only shows once everything is found. */
const formatPercent = (percent: number) => `${Math.floor(percent)}%`;

function NextDestinationForm() {
  const note = useUiStore((s) => s.nextNote);
  const setNote = useUiStore((s) => s.setNextNote);
  const placing = useUiStore((s) => s.placing);
  const setPlacing = useUiStore((s) => s.setPlacing);

  return (
    <div className={styles.form}>
      <input
        type="text"
        value={note}
        maxLength={NOTE_MAX_LENGTH}
        placeholder="Note for your next destination, e.g. beat Margit"
        onChange={(e) => setNote(e.target.value)}
      />
      <Button variant="primary" onClick={() => setPlacing(!placing)}>
        {placing ? 'Cancel' : 'Pick next destination on map'}
      </Button>
      <small className={styles.muted}>Or double-click any point or pin on the map.</small>
    </div>
  );
}
