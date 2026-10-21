import type { CSSProperties } from 'react';
import { useCoopSync } from '@/features/coop/useCoopSync';
import { MapView } from '@/features/map/MapView';
import { useSession } from '@/features/session/SessionContext';
import { Sidebar } from '@/features/sidebar/Sidebar';
import styles from './AppLayout.module.css';

export function AppLayout() {
  const { me, players } = useSession();
  useCoopSync();

  // Player colors come from the server and are used as CSS variables.
  const playerColors = {
    '--p1': players.p1.color,
    '--p2': players.p2.color,
    '--me': players[me].color,
  } as CSSProperties;

  return (
    <div className={styles.layout} style={playerColors}>
      <Sidebar />
      <MapView />
    </div>
  );
}
