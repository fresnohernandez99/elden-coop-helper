import { useState } from 'react';
import { localTeam } from '@/features/coop/localTeam';
import { Button } from '@/shared/ui/Button';
import { Section } from '@/shared/ui/Section';
import type { TeamInfo } from '@/types/domain';
import styles from './TeamPanel.module.css';

/** The link and password to invite friends, as far as this browser knows the password. */
export function TeamPanel({ team }: { team: TeamInfo }) {
  const [local] = useState(() => localTeam.get(team.id));
  const [shown, setShown] = useState(false);
  const link = `${window.location.origin}/team/${team.id}`;
  const invite = local?.password ? `${link}\nPassword: ${local.password}` : link;

  return (
    <Section
      title="Team"
      actions={local?.creatorKey ? <small className={styles.muted}>you created it</small> : undefined}
    >
      <p className={styles.line}>
        Password:{' '}
        {local?.password ? (
          <button type="button" className={styles.secret} onClick={() => setShown(!shown)}>
            {shown ? local.password : '••••••'}
          </button>
        ) : (
          <span className={styles.muted}>ask the team creator</span>
        )}
      </p>
      <Button size="small" onClick={() => void navigator.clipboard?.writeText(invite)}>
        Copy invite
      </Button>
    </Section>
  );
}
