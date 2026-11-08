import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { teamsApi } from '@/api/teamsApi';
import { usePlayerNames } from '@/features/coop/playerNames';
import { showToast } from '@/features/notifications/toastStore';
import { useSession } from '@/features/session/SessionContext';
import { useUiStore } from '@/features/ui/uiStore';
import { BackupPanel } from './BackupPanel';
import { CategoryFilter } from './CategoryFilter';
import { MapTabs } from './MapTabs';
import { PlayersPanel } from './PlayersPanel';
import { SearchPanel } from './SearchPanel';
import { TeamPanel } from './TeamPanel';
import styles from './Sidebar.module.css';

/**
 * Every action lives here. On desktop it is a fixed column; on phones it is a
 * drawer opened from the top-left button, so the rest of the screen is just the map.
 */
export function Sidebar() {
  const { me, team } = useSession();
  const names = usePlayerNames();
  const open = useUiStore((s) => s.sidebarOpen);
  const setOpen = useUiStore((s) => s.setSidebarOpen);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, setOpen]);

  return (
    <>
      {open && <div className={styles.backdrop} onClick={() => setOpen(false)} aria-hidden />}
      <aside id="sidebar" className={`${styles.sidebar} ${open ? styles.open : ''}`} aria-label="Map controls">
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Elden Co-op Map</h1>
            <p className={styles.subtitle}>
              {!team ? (
                <>Playing solo · </>
              ) : me ? (
                <>
                  <strong style={{ color: 'var(--me)' }}>{names[me]}</strong> in <strong>{team.name}</strong> ·{' '}
                </>
              ) : (
                <>
                  Watching <strong>{team.name}</strong> (read-only) ·{' '}
                </>
              )}
              <Link href="/" className={styles.link}>
                lobby
              </Link>
              {team && (
                <>
                  {' · '}
                  <LeaveButton teamId={team.id} label={me ? 'leave team' : 'stop watching'} />
                </>
              )}
            </p>
          </div>
          <button type="button" className={styles.close} aria-label="Close panel" onClick={() => setOpen(false)}>
            ×
          </button>
        </header>

        {team && me && <TeamPanel team={team} />}
        <PlayersPanel />
        <MapTabs />
        <SearchPanel />
        <CategoryFilter />
        {me && <BackupPanel me={me} />}

        <p className={styles.credit}>Data and maps: Game8 / FromSoftware. For personal use only.</p>
      </aside>
    </>
  );
}

/**
 * Leaves the team (a player frees their slot; joining again needs the password)
 * or stops watching. Your own progress stays in this browser.
 */
function LeaveButton({ teamId, label }: { teamId: string; label: string }) {
  const router = useRouter();

  const leave = async () => {
    try {
      await teamsApi.leave(teamId);
      router.replace('/');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not leave the team');
    }
  };

  return (
    <button type="button" className={styles.link} onClick={() => void leave()}>
      {label}
    </button>
  );
}
