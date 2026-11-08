'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { teamsApi } from '@/api/teamsApi';
import { TEAM_NAME_MAX_LENGTH, TEAMS_PAGE_SIZE } from '@/config/constants';
import { Button } from '@/shared/ui/Button';
import type { TeamSummary } from '@/types/domain';
import styles from './Lobby.module.css';

const SEARCH_DELAY_MS = 300;

/** Every team, most recently active first. Anyone can watch; joining needs the password. */
export function TeamList() {
  const [search, setSearch] = useState('');
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(
      () =>
        teamsApi.list(search, page).then(
          (found) => {
            if (cancelled) return;
            setTeams((previous) => (page === 0 ? found : [...previous, ...found]));
            setHasMore(found.length === TEAMS_PAGE_SIZE);
            setError(null);
          },
          (err: unknown) => !cancelled && setError(err instanceof Error ? err.message : 'Could not load the teams'),
        ),
      page === 0 ? SEARCH_DELAY_MS : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, page]);

  return (
    <div className={styles.card}>
      <h2 className={styles.heading}>Teams</h2>
      <input
        type="search"
        value={search}
        maxLength={TEAM_NAME_MAX_LENGTH}
        placeholder="Search by name"
        aria-label="Search teams by name"
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(0);
        }}
      />
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <ul className={styles.teams}>
        {teams.map((team) => (
          <TeamRow key={team.id} team={team} />
        ))}
      </ul>
      {teams.length === 0 && !error && <p className={styles.hint}>No teams yet.</p>}
      {hasMore && <Button onClick={() => setPage(page + 1)}>More teams</Button>}
    </div>
  );
}

function TeamRow({ team }: { team: TeamSummary }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function watch() {
    setBusy(true);
    try {
      await teamsApi.watch(team.id);
      router.push('/map');
    } catch {
      setBusy(false);
    }
  }

  return (
    <li className={styles.team}>
      <span className={styles.teamInfo}>
        <strong>{team.name}</strong>
        <small>
          {team.players.length}/3 · {team.players.join(', ') || 'nobody'}
        </small>
      </span>
      <Button size="small" disabled={busy} onClick={() => void watch()}>
        Watch
      </Button>
      <Link href={`/team/${team.id}`} className={styles.joinLink}>
        Join
      </Link>
    </li>
  );
}
