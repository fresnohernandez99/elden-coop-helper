import { useCallback, useMemo } from 'react';
import { PLAYER_IDS } from '@/config/constants';
import { useSession } from '@/features/session/SessionContext';
import type { PlayerId } from '@/types/domain';
import { useCoopStore } from './coopStore';

/** Character name of each player, falling back to "Player N" until they pick one. */
export function usePlayerNames(): Record<PlayerId, string> {
  const { players } = useSession();
  // Joined into one string so the selector only changes when a name changes.
  const key = useCoopStore((s) => PLAYER_IDS.map((id) => s.players[id]?.name ?? '').join('\u0000'));

  return useMemo(() => {
    const names = key.split('\u0000');
    return Object.fromEntries(
      PLAYER_IDS.map((id, i) => [id, names[i] || players.find((p) => p.id === id)?.name || `Player ${i + 1}`]),
    ) as Record<PlayerId, string>;
  }, [key, players]);
}

/** Player name, with " (you)" for the current player. */
export function usePlayerLabel() {
  const { me } = useSession();
  const names = usePlayerNames();
  return useCallback((id: PlayerId) => names[id] + (id === me ? ' (you)' : ''), [names, me]);
}
