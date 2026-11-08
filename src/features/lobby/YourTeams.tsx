'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiError } from '@/api/http';
import { teamsApi } from '@/api/teamsApi';
import { localProgress } from '@/features/coop/localProgress';
import { localTeam, type LocalTeam } from '@/features/coop/localTeam';
import { Button } from '@/shared/ui/Button';
import styles from './Lobby.module.css';

/**
 * Teams this browser joined or created, rejoined with one click using the saved
 * password and name. The server gives you back your own slot, so your progress
 * and place in the team are kept. Hidden when there are none.
 */
export function YourTeams({ currentTeamId }: { currentTeamId: string | null }) {
  const router = useRouter();
  const [teams, setTeams] = useState<[string, LocalTeam][]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // After mounting: localStorage does not exist while rendering on the server.
  useEffect(() => setTeams(localTeam.joinable()), []);

  function forget(teamId: string) {
    localTeam.forget(teamId);
    setTeams(localTeam.joinable());
  }

  async function enter(teamId: string, team: LocalTeam) {
    const playerName = localProgress.loadLastName();
    // Without a saved name, the join form asks for it (with the password filled in).
    if (!playerName) return router.push(`/team/${teamId}`);
    setBusy(teamId);
    setError(null);
    try {
      await teamsApi.join(teamId, team.password!, playerName, localTeam.clientId());
      router.push('/map');
    } catch (err) {
      setBusy(null);
      if (err instanceof ApiError && err.status === 404) forget(teamId);
      setError(`${team.name}: ${err instanceof Error ? err.message : 'Could not join'}`);
    }
  }

  if (teams.length === 0) return null;

  return (
    <div className={styles.card}>
      <h2 className={styles.heading}>Your teams</h2>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <ul className={styles.teams}>
        {teams.map(([id, team]) => (
          <li key={id} className={styles.team}>
            <span className={styles.teamInfo}>
              <strong>{team.name}</strong>
              {team.creatorKey && <small>Created by you</small>}
            </span>
            {id === currentTeamId ? (
              <Link href="/map" className={styles.joinLink}>
                Open
              </Link>
            ) : (
              <Button size="small" disabled={busy !== null} onClick={() => void enter(id, team)}>
                {busy === id ? 'Joining…' : 'Enter'}
              </Button>
            )}
            <button
              type="button"
              className={styles.forget}
              title="Remove from this list"
              aria-label={`Remove ${team.name} from this list`}
              onClick={() => forget(id)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
