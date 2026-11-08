'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { localTeam } from '@/features/coop/localTeam';
import { CreateTeamForm } from './CreateTeamForm';
import styles from './Lobby.module.css';
import { TeamList } from './TeamList';

export interface CurrentTeam {
  teamId: string;
  spectator: boolean;
}

/**
 * Entry point: play solo (nothing leaves the browser), create a team, or pick
 * one from the list to join (with its password) or watch (no password).
 */
export function Lobby({ current }: { current: CurrentTeam | null }) {
  const [currentName, setCurrentName] = useState<string | null>(null);
  // After mounting: localStorage does not exist while rendering on the server.
  useEffect(() => {
    if (current) setCurrentName(localTeam.get(current.teamId)?.name ?? null);
  }, [current]);

  return (
    <main className={styles.screen}>
      <div className={styles.lobby}>
        <div className={styles.card}>
          <h1 className={styles.title}>Elden Co-op Map</h1>
          <p className={styles.subtitle}>Your progress stays in this browser. Teams share it while you play.</p>
          {current && (
            <Link href="/map" className={styles.primaryLink}>
              {current.spectator ? 'Keep watching' : 'Continue in'} {currentName ? `“${currentName}”` : 'your team'}
            </Link>
          )}
          <Link href="/solo" className={styles.secondaryLink}>
            Play solo
          </Link>
        </div>
        <CreateTeamForm />
        <TeamList />
      </div>
    </main>
  );
}
