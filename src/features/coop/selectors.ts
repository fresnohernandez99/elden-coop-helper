import { useMemo } from 'react';
import type { NextDestination, Pin, PlayerId, PlayerProgress } from '@/types/domain';
import { useCoopStore } from './coopStore';

type PlayersById = Partial<Record<PlayerId, PlayerProgress>>;

export const isFoundBy = (players: PlayersById, player: PlayerId, pinId: string) =>
  !!players[player] && pinId in players[player].found;

const splitIds = (key: string) => (key ? (key.split(',') as PlayerId[]) : []);

type VisibleState = Pick<ReturnType<typeof useCoopStore.getState>, 'me' | 'players'>;

/**
 * You first (unless spectating), then every other player whose progress was
 * ever received, online or not: their last data stays until a newer one arrives.
 */
function visibleIds({ me, players }: VisibleState): PlayerId[] {
  const others = (Object.keys(players) as PlayerId[]).filter((p) => p !== me && (players[p]?.rev ?? 0) > 0);
  return me ? [me, ...others] : others;
}

/** Players shown in the UI (see visibleIds), in slot order after you. */
export function useVisiblePlayers(): PlayerId[] {
  // A string key keeps the selector stable; the array is rebuilt only when it changes.
  const key = useCoopStore((s) => visibleIds(s).join(','));
  return useMemo(() => splitIds(key), [key]);
}

/**
 * Visible players who found the pin, as a stable string ("", "p1", "p1,p3").
 * Returning a string avoids re-rendering the marker when nothing changed.
 */
export function useFoundByKey(pinId: string): string {
  return useCoopStore((s) => visibleIds(s).filter((p) => isFoundBy(s.players, p, pinId)).join(','));
}

export const parseFoundByKey = splitIds;

/** Your player slot, or null when spectating. */
export const useMe = () => useCoopStore((s) => s.me);

export const useIsOnline = (player: PlayerId) => useCoopStore((s) => s.me === player || s.online.includes(player));

export const useOnlineCount = () => useCoopStore((s) => s.online.length + (s.me ? 1 : 0));

const NOTHING_FOUND: Record<string, number> = {};

export const useFoundMap = (player: PlayerId) => useCoopStore((s) => s.players[player]?.found ?? NOTHING_FOUND);

export const useNextDestination = (player: PlayerId) => useCoopStore((s) => s.players[player]?.next ?? null);

export function countFound(pins: readonly Pin[], found: Record<string, number>): number {
  return pins.reduce((total, pin) => total + (pin.id in found ? 1 : 0), 0);
}

export function nextDestinationTitle(next: NextDestination, pinsById: Map<string, Pin>): string {
  return (next.pinId && pinsById.get(next.pinId)?.title) || 'Point on the map';
}
