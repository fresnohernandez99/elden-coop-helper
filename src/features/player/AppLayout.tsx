import type { CSSProperties } from 'react';
import { useCoopSync } from '@/features/coop/useCoopSync';
import { MapView } from '@/features/map/MapView';
import { useSession } from '@/features/session/SessionContext';
import { Sidebar } from '@/features/sidebar/Sidebar';
import styles from './AppLayout.module.css';

export function AppLayout() {
  const { me, players } = useSession();
  useCoopSync();

  // Player colors come from the server and are used as CSS variables (--p1 … --p6, --me).
  // Spectators have no color of their own and keep the default --me.
  const playerColors = Object.fromEntries([
    ...players.map((p) => [`--${p.id}`, p.color]),
    ...(me ? [['--me', players.find((p) => p.id === me)?.color]] : []),
  ]) as CSSProperties;

  return (
    <div className={styles.layout} style={playerColors}>
      <Sidebar />
      <MapView />
    </div>
  );
}
