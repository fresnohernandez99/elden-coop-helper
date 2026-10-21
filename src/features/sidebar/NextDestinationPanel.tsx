import { NOTE_MAX_LENGTH, PLAYER_IDS } from '@/config/constants';
import { useCoopStore } from '@/features/coop/coopStore';
import { usePlayerLabel } from '@/features/coop/playerNames';
import { nextDestinationTitle, useNextDestination } from '@/features/coop/selectors';
import { usePins } from '@/features/pins/PinsContext';
import { useSession } from '@/features/session/SessionContext';
import { useUiStore } from '@/features/ui/uiStore';
import { Button } from '@/shared/ui/Button';
import { Section } from '@/shared/ui/Section';
import type { PlayerId } from '@/types/domain';
import styles from './NextDestinationPanel.module.css';

export function NextDestinationPanel() {
  const { me } = useSession();
  const note = useUiStore((s) => s.nextNote);
  const setNote = useUiStore((s) => s.setNextNote);
  const placing = useUiStore((s) => s.placing);
  const setPlacing = useUiStore((s) => s.setPlacing);
  // Current player first.
  const order = [me, ...PLAYER_IDS.filter((p) => p !== me)];

  return (
    <Section title="Next destination">
      {order.map((p) => (
        <NextDestinationCard key={p} player={p} />
      ))}
      <div className={styles.form}>
        <input
          type="text"
          value={note}
          maxLength={NOTE_MAX_LENGTH}
          placeholder="Note (optional), e.g. beat Margit"
          onChange={(e) => setNote(e.target.value)}
        />
        <Button variant="primary" onClick={() => setPlacing(!placing)}>
          {placing ? 'Cancel' : 'Pick on map'}
        </Button>
      </div>
    </Section>
  );
}

function NextDestinationCard({ player }: { player: PlayerId }) {
  const { me } = useSession();
  const { pinsById } = usePins();
  const playerLabel = usePlayerLabel();
  const next = useNextDestination(player);
  const clearNext = useCoopStore((s) => s.clearNext);
  const focusOn = useUiStore((s) => s.focusOn);

  return (
    <div className={styles.card} style={{ borderColor: `var(--${player})` }}>
      <div className={styles.header}>
        <strong>{playerLabel(player)}</strong>
        {next && (
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
        )}
      </div>
      {next ? (
        <div>
          {nextDestinationTitle(next, pinsById)} <small className={styles.muted}>· {next.area}</small>
        </div>
      ) : (
        <div className={styles.muted}>No destination</div>
      )}
      {next?.note && <div className={styles.note}>“{next.note}”</div>}
    </div>
  );
}
