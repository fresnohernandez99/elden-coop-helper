import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { authApi } from '@/api/authApi';
import { usePlayerNames } from '@/features/coop/playerNames';
import { showToast } from '@/features/notifications/toastStore';
import { useSession } from '@/features/session/SessionContext';
import { useUiStore } from '@/features/ui/uiStore';
import { BackupPanel } from './BackupPanel';
import { CategoryFilter } from './CategoryFilter';
import { MapTabs } from './MapTabs';
import { NextDestinationPanel } from './NextDestinationPanel';
import { ProgressPanel } from './ProgressPanel';
import { SearchPanel } from './SearchPanel';
import styles from './Sidebar.module.css';

/**
 * Every action lives here. On desktop it is a fixed column; on phones it is a
 * drawer opened from the top-left button, so the rest of the screen is just the map.
 */
export function Sidebar() {
  const { me } = useSession();
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
              Playing as <strong style={{ color: 'var(--me)' }}>{names[me]}</strong> · <SwitchCharacterButton />
            </p>
          </div>
          <button type="button" className={styles.close} aria-label="Close panel" onClick={() => setOpen(false)}>
            ×
          </button>
        </header>

        <ProgressPanel />
        <NextDestinationPanel />
        <MapTabs />
        <SearchPanel />
        <CategoryFilter />
        <BackupPanel />

        <p className={styles.credit}>Data and maps: Game8 / FromSoftware. For personal use only.</p>
      </aside>
    </>
  );
}

/** Logs out so you can log in again with another character name. Progress stays. */
function SwitchCharacterButton() {
  const router = useRouter();

  const switchCharacter = async () => {
    try {
      await authApi.logout();
      router.replace('/');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not log out');
    }
  };

  return (
    <button type="button" className={styles.link} onClick={() => void switchCharacter()}>
      switch character
    </button>
  );
}
