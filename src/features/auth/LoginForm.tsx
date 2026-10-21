'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { authApi } from '@/api/authApi';
import { CHARACTER_NAME_MAX_LENGTH } from '@/config/constants';
import { localProgress } from '@/features/coop/localProgress';
import { Button } from '@/shared/ui/Button';
import styles from './LoginForm.module.css';

/**
 * Login with a character name and a password. The password picks the player
 * slot; the name is free and can change on every login (it is the character
 * being played), so it is only stored locally and shared through sync.
 */
export function LoginForm() {
  const router = useRouter();
  const [name, setName] = useState(() => localProgress.loadLastName());
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const characterName = name.trim();
    if (!characterName) {
      setError('Enter your character name');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const player = await authApi.login(password);
      localProgress.setOwnName(player, characterName);
      router.replace('/map');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log in');
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.screen}>
      <form className={styles.card} onSubmit={submit}>
        <h1 className={styles.title}>Elden Co-op Map</h1>

        <label className={styles.field}>
          <span>Character name</span>
          <input
            type="text"
            value={name}
            maxLength={CHARACTER_NAME_MAX_LENGTH}
            autoComplete="nickname"
            autoFocus={!name}
            required
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span>Password</span>
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            autoFocus={!!name}
            required
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? 'Entering…' : 'Enter'}
        </Button>
      </form>
    </main>
  );
}
