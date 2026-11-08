'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import { type CreatedTeam, teamsApi } from '@/api/teamsApi';
import { CHARACTER_NAME_MAX_LENGTH, TEAM_NAME_MAX_LENGTH } from '@/config/constants';
import { localProgress } from '@/features/coop/localProgress';
import { localTeam } from '@/features/coop/localTeam';
import { Button } from '@/shared/ui/Button';
import styles from './Lobby.module.css';

/**
 * Creates a team with you as its first player. The server returns the password
 * to share and the creator key, which only this browser keeps (it lets you
 * remove players later).
 */
export function CreateTeamForm() {
  const router = useRouter();
  const [teamName, setTeamName] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedTeam | null>(null);

  // After mounting: localStorage does not exist while rendering on the server.
  useEffect(() => setPlayerName(localProgress.loadLastName()), []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await teamsApi.create(teamName, playerName, localTeam.clientId());
      localTeam.save(result.team.id, { name: result.team.name, password: result.password, creatorKey: result.creatorKey });
      localProgress.setOwnName(playerName);
      setCreated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the team');
    } finally {
      setSubmitting(false);
    }
  }

  if (created) return <CreatedTeamCard created={created} onContinue={() => router.push('/map')} />;

  return (
    <form className={styles.card} onSubmit={submit}>
      <h2 className={styles.heading}>Create a team</h2>
      <label className={styles.field}>
        <span>
          Team name ({[...teamName].length}/{TEAM_NAME_MAX_LENGTH})
        </span>
        <input
          type="text"
          value={teamName}
          maxLength={TEAM_NAME_MAX_LENGTH}
          required
          onChange={(e) => setTeamName(e.target.value)}
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
      <p className={styles.hint}>Up to 3 players, you included. Anyone can watch your team without a password.</p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={submitting}>
        {submitting ? 'Creating…' : 'Create team'}
      </Button>
    </form>
  );
}

function CreatedTeamCard({ created, onContinue }: { created: CreatedTeam; onContinue: () => void }) {
  const link = `${window.location.origin}/team/${created.team.id}`;
  const copy = (text: string) => void navigator.clipboard?.writeText(text);

  return (
    <div className={styles.card}>
      <h2 className={styles.heading}>Team “{created.team.name}” created</h2>
      <p className={styles.hint}>Send your friends the link and the password. They join with it and their own name.</p>
      <div className={styles.secret}>{created.password}</div>
      <div className={styles.row}>
        <span className={styles.link}>{link}</span>
        <Button size="small" onClick={() => copy(`${link}\nPassword: ${created.password}`)}>
          Copy
        </Button>
      </div>
      <p className={styles.hint}>
        Only this browser can remove players from the team. Keep it, or export a backup from the map.
      </p>
      <Button variant="primary" onClick={onContinue}>
        Go to the map
      </Button>
    </div>
  );
}
