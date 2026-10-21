import { useCallback, useMemo } from 'react';
import { useSession } from '@/features/session/SessionContext';
import type { PlayerId } from '@/types/domain';
import { useCoopStore } from './coopStore';

/** Character name of each player, falling back to "Player N" until they pick one. */
export function usePlayerNames(): Record<PlayerId, string> {
  const { players } = useSession();
  const p1 = useCoopStore((s) => s.players.p1.name);
  const p2 = useCoopStore((s) => s.players.p2.name);
  return useMemo(() => ({ p1: p1 || players.p1.name, p2: p2 || players.p2.name }), [p1, p2, players]);
}

/** Player name, with " (you)" for the current player. */
export function usePlayerLabel() {
  const { me } = useSession();
  const names = usePlayerNames();
  return useCallback((id: PlayerId) => names[id] + (id === me ? ' (you)' : ''), [names, me]);
}
