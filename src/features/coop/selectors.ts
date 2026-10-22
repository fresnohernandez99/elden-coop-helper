import { useMemo } from 'react';
import type { NextDestination, Pin, PlayerId, PlayerProgress } from '@/types/domain';
import { useCoopStore } from './coopStore';

type PlayersById = Partial<Record<PlayerId, PlayerProgress>>;

export const isFoundBy = (players: PlayersById, player: PlayerId, pinId: string) =>
  !!players[player] && pinId in players[player].found;

const splitIds = (key: string) => (key ? (key.split(',') as PlayerId[]) : []);

/** Players shown in the UI: you first, then whoever is online. */
export function useVisiblePlayers(): PlayerId[] {
  // A string key keeps the selector stable; the array is rebuilt only when it changes.
  const key = useCoopStore((s) => [s.me, ...s.online].join(','));
  return useMemo(() => splitIds(key), [key]);
}

/**
 * Visible players who found the pin, as a stable string ("", "p1", "p1,p3").
 * Returning a string avoids re-rendering the marker when nothing changed.
 */
export function useFoundByKey(pinId: string): string {
  return useCoopStore((s) => [s.me, ...s.online].filter((p) => isFoundBy(s.players, p, pinId)).join(','));
}

export const parseFoundByKey = splitIds;

export const useMe = () => useCoopStore((s) => s.me);

const NOTHING_FOUND: Record<string, number> = {};

export const useFoundMap = (player: PlayerId) => useCoopStore((s) => s.players[player]?.found ?? NOTHING_FOUND);

export const useNextDestination = (player: PlayerId) => useCoopStore((s) => s.players[player]?.next ?? null);

export function countFound(pins: readonly Pin[], found: Record<string, number>): number {
  return pins.reduce((total, pin) => total + (pin.id in found ? 1 : 0), 0);
}

export function nextDestinationTitle(next: NextDestination, pinsById: Map<string, Pin>): string {
  return (next.pinId && pinsById.get(next.pinId)?.title) || 'Point on the map';
}
