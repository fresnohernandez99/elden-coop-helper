import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { teamsApi } from '@/api/teamsApi';
import { useCoopStore } from '@/features/coop/coopStore';
import { localTeam } from '@/features/coop/localTeam';
import { showToast } from '@/features/notifications/toastStore';
import { useSession } from '@/features/session/SessionContext';
import { Button } from '@/shared/ui/Button';
import { PlayerDot } from '@/shared/ui/PlayerDot';
import { Section } from '@/shared/ui/Section';
import type { PlayerId, TeamInfo, TeamRoster } from '@/types/domain';
import styles from './TeamPanel.module.css';

const errorText = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

/**
 * The invite (link and password, as far as this browser knows the password),
 * the members, and leaving the team. The owner can also remove players and hand
 * the team over. Members are read once when the panel opens and after each change.
 */
export function TeamPanel({ team }: { team: TeamInfo }) {
  const { me } = useSession();
  const [local, setLocal] = useState(() => localTeam.get(team.id));
  const [roster, setRoster] = useState<TeamRoster | null>(null);
  const [shown, setShown] = useState(false);
  const link = `${window.location.origin}/team/${team.id}`;
  const invite = local?.password ? `${link}\nPassword: ${local.password}` : link;

  const loadRoster = useCallback(
    () =>
      teamsApi
        .members(team.id)
        .then(setRoster)
        .catch((error: unknown) => showToast(errorText(error, 'Could not load the team'))),
    [team.id],
  );
  useEffect(() => void loadRoster(), [loadRoster]);

  // Teams from before ownership could be passed on only know their owner by the creator key.
  const amOwner = !!roster && (roster.owner === me || (roster.owner === null && !!local?.creatorKey));
  const others = roster?.members.filter((m) => m.slot !== me) ?? [];
  // Names from the server, so players who joined after this page loaded show theirs.
  const label = (slot: PlayerId) =>
    (roster?.members.find((m) => m.slot === slot)?.name ?? slot) + (slot === me ? ' (you)' : '');

  async function kick(slot: PlayerId) {
    await teamsApi.kick(team.id, slot, local?.creatorKey);
    useCoopStore.getState().keepMembers(roster!.members.map((m) => m.slot).filter((id) => id !== slot));
    await loadRoster();
  }

  async function transfer(slot: PlayerId) {
    await teamsApi.transfer(team.id, slot, local?.creatorKey);
    localTeam.dropCreatorKey(team.id);
    setLocal(localTeam.get(team.id));
    await loadRoster();
  }

  return (
    <Section title="Team" actions={amOwner ? <small className={styles.muted}>you own it</small> : undefined}>
      <p className={styles.line}>
        Password:{' '}
        {local?.password ? (
          <button type="button" className={styles.secret} onClick={() => setShown(!shown)}>
            {shown ? local.password : '••••••'}
          </button>
        ) : (
          <span className={styles.muted}>ask the team owner</span>
        )}
      </p>
      <Button size="small" onClick={() => void navigator.clipboard?.writeText(invite)}>
        Copy invite
      </Button>

      {roster && (
        <ul className={styles.members}>
          {roster.members.map(({ slot }) => (
            <MemberRow
              key={slot}
              slot={slot}
              label={label(slot)}
              isOwner={roster.owner === slot}
              manage={amOwner && slot !== me}
              onKick={kick}
              onTransfer={transfer}
            />
          ))}
        </ul>
      )}

      <LeaveTeam
        team={team}
        amOwner={amOwner}
        others={others.map((m) => m.slot)}
        label={label}
        creatorKey={local?.creatorKey}
      />
    </Section>
  );
}

interface MemberRowProps {
  slot: PlayerId;
  label: string;
  isOwner: boolean;
  /** The owner sees "Make owner" and "Remove" on everyone else. */
  manage: boolean;
  onKick: (slot: PlayerId) => Promise<void>;
  onTransfer: (slot: PlayerId) => Promise<void>;
}

/** A member; owner actions ask for a second click to confirm. */
function MemberRow({ slot, label, isOwner, manage, onKick, onTransfer }: MemberRowProps) {
  const [confirming, setConfirming] = useState<'kick' | 'transfer' | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: 'kick' | 'transfer') {
    if (confirming !== action) return setConfirming(action);
    setBusy(true);
    try {
      if (action === 'kick') await onKick(slot);
      else await onTransfer(slot);
      showToast(
        action === 'kick' ? `${label} was removed from the team` : `${label} now owns the team`,
      );
    } catch (error) {
      showToast(errorText(error, 'Could not change the team'));
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  }

  return (
    <li className={styles.member}>
      <span className={styles.memberName}>
        <PlayerDot player={slot} />
        {label}
        {isOwner && <small className={styles.muted}> · owner</small>}
      </span>
      {manage && (
        <span className={styles.memberActions} onBlur={() => setConfirming(null)}>
          <Button size="small" disabled={busy} onClick={() => void run('transfer')}>
            {confirming === 'transfer' ? 'Hand over? Click again' : 'Make owner'}
          </Button>
          <Button size="small" disabled={busy} onClick={() => void run('kick')}>
            {confirming === 'kick' ? 'Remove and ban? Click again' : 'Remove'}
          </Button>
        </span>
      )}
    </li>
  );
}

interface LeaveTeamProps {
  team: TeamInfo;
  amOwner: boolean;
  others: PlayerId[];
  label: (slot: PlayerId) => string;
  creatorKey?: string;
}

/**
 * Leaving deletes your slot and the progress saved in this team (your own
 * progress stays in this browser) and drops the team from your lobby list.
 * An owner picks who gets the team.
 */
function LeaveTeam({ team, amOwner, others, label, creatorKey }: LeaveTeamProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newOwner, setNewOwner] = useState<PlayerId | ''>('');
  const heir = newOwner && others.includes(newOwner) ? newOwner : others[0];

  async function leave() {
    setBusy(true);
    try {
      await teamsApi.leave(team.id, { creatorKey, newOwner: amOwner ? heir : undefined });
      localTeam.remove(team.id);
      router.replace('/');
    } catch (error) {
      setBusy(false);
      showToast(errorText(error, 'Could not leave the team'));
    }
  }

  if (!open) {
    return (
      <div className={styles.leave}>
        <Button size="small" onClick={() => setOpen(true)}>
          Leave team
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.leave}>
      <p className={styles.line}>
        Leave <strong>{team.name}</strong>? Your progress saved in this team is deleted for everyone; it stays in this
        browser.
      </p>
      {amOwner && heir && (
        <label className={styles.line}>
          New owner:{' '}
          <select value={heir} onChange={(e) => setNewOwner(e.target.value as PlayerId)}>
            {others.map((slot) => (
              <option key={slot} value={slot}>
                {label(slot)}
              </option>
            ))}
          </select>
        </label>
      )}
      <span className={styles.memberActions}>
        <Button size="small" variant="primary" disabled={busy} onClick={() => void leave()}>
          {busy ? 'Leaving…' : 'Leave and delete my data'}
        </Button>
        <Button size="small" disabled={busy} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </span>
    </div>
  );
}
