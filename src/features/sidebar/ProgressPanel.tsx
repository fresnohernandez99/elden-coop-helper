import { useMemo } from 'react';
import { PLAYER_IDS } from '@/config/constants';
import { usePlayerLabel } from '@/features/coop/playerNames';
import { countFound, useFoundMap } from '@/features/coop/selectors';
import { usePins } from '@/features/pins/PinsContext';
import { useUiStore } from '@/features/ui/uiStore';
import { PlayerDot } from '@/shared/ui/PlayerDot';
import { Section } from '@/shared/ui/Section';
import type { Pin, PlayerId } from '@/types/domain';
import styles from './ProgressPanel.module.css';

export function ProgressPanel() {
  const { pins } = usePins();
  const currentMap = useUiStore((s) => s.currentMap);
  const pinsOnMap = useMemo(() => pins.filter((pin) => pin.area === currentMap), [pins, currentMap]);

  return (
    <Section title="Progress">
      {PLAYER_IDS.map((p) => (
        <ProgressRow key={p} player={p} pins={pins} pinsOnMap={pinsOnMap} mapTitle={currentMap ?? ''} />
      ))}
    </Section>
  );
}

interface ProgressRowProps {
  player: PlayerId;
  pins: Pin[];
  pinsOnMap: Pin[];
  mapTitle: string;
}

function ProgressRow({ player, pins, pinsOnMap, mapTitle }: ProgressRowProps) {
  const playerLabel = usePlayerLabel();
  const found = useFoundMap(player);
  const total = useMemo(() => countFound(pins, found), [pins, found]);
  const onMap = useMemo(() => countFound(pinsOnMap, found), [pinsOnMap, found]);
  const percent = pins.length ? (total / pins.length) * 100 : 0;

  return (
    <div className={styles.row}>
      <div className={styles.line}>
        <span>
          <PlayerDot player={player} />
          {playerLabel(player)}
        </span>
        <span>
          {total} / {pins.length}
        </span>
      </div>
      <div className={styles.bar}>
        <span style={{ width: `${percent.toFixed(1)}%`, background: `var(--${player})` }} />
      </div>
      <small className={styles.muted}>
        {mapTitle}: {onMap} / {pinsOnMap.length}
      </small>
    </div>
  );
}
