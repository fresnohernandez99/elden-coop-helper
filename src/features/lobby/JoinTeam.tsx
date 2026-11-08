'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import { teamsApi } from '@/api/teamsApi';
import { CHARACTER_NAME_MAX_LENGTH, TEAM_PASSWORD_LENGTH } from '@/config/constants';
import { localProgress } from '@/features/coop/localProgress';
import { localTeam } from '@/features/coop/localTeam';
import { Button } from '@/shared/ui/Button';
import type { TeamSummary } from '@/types/domain';
import styles from './Lobby.module.css';

/** /team/<id>: join with the team password and your name, or watch without one. */
export function JoinTeam({ team }: { team: TeamSummary }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // After mounting: localStorage does not exist while rendering on the server.
  useEffect(() => {
    setPassword(localTeam.get(team.id)?.password ?? '');
    setPlayerName(localProgress.loadLastName());
  }, [team.id]);

  async function run(action: () => Promise<unknown>, fallback: string) {
    setSubmitting(true);
    setError(null);
    try {
      await action();
      router.replace('/map');
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
      setSubmitting(false);
    }
  }

  const join = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await teamsApi.join(team.id, password, playerName, localTeam.clientId());
      localTeam.save(team.id, { name: team.name, password: password.trim().toUpperCase() });
      localProgress.setOwnName(playerName);
    }, 'Could not join the team');
  };

  return (
    <main className={styles.screen}>
      <form className={styles.card} onSubmit={join}>
        <h1 className={styles.title}>{team.name}</h1>
        <p className={styles.subtitle}>
          {team.players.length}/3 players{team.players.length > 0 && `: ${team.players.join(', ')}`}
        </p>

        <label className={styles.field}>
          <span>Team password</span>
          <input
            type="text"
            value={password}
            maxLength={TEAM_PASSWORD_LENGTH + 4}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            required
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>Your name</span>
          <input
            type="text"
            value={playerName}
            maxLength={CHARACTER_NAME_MAX_LENGTH}
            autoComplete="nickname"
            required
            onChange={(e) => setPlayerName(e.target.value)}
          />
        </label>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? 'Joining…' : 'Join the team'}
        </Button>
        <button
          type="button"
          className={styles.switchMode}
          disabled={submitting}
          onClick={() => void run(() => teamsApi.watch(team.id), 'Could not watch the team')}
        >
          Just watch (read-only, no password)
        </button>
        <Link href="/" className={styles.switchMode}>
          ← All teams
        </Link>
      </form>
    </main>
  );
}
