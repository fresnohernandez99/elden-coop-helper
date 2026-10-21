import { PLAYER_IDS } from '@/config/constants';
import type { NextDestination, Pin, PlayerId, PlayerProgress } from '@/types/domain';
import { useCoopStore } from './coopStore';

export const isFoundBy = (players: Record<PlayerId, PlayerProgress>, player: PlayerId, pinId: string) =>
  pinId in players[player].found;

/**
 * Players who found the pin, as a stable string ("", "p1", "p1,p2").
 * Returning a string avoids re-rendering the marker when nothing changed.
 */
export function useFoundByKey(pinId: string): string {
  return useCoopStore((s) => PLAYER_IDS.filter((p) => isFoundBy(s.players, p, pinId)).join(','));
}

export const parseFoundByKey = (key: string) => (key ? (key.split(',') as PlayerId[]) : []);

export const useMe = () => useCoopStore((s) => s.me);

export const useFoundMap = (player: PlayerId) => useCoopStore((s) => s.players[player].found);

export const useNextDestination = (player: PlayerId) => useCoopStore((s) => s.players[player].next);

export function countFound(pins: readonly Pin[], found: Record<string, number>): number {
  return pins.reduce((total, pin) => total + (pin.id in found ? 1 : 0), 0);
}

export function nextDestinationTitle(next: NextDestination, pinsById: Map<string, Pin>): string {
  return (next.pinId && pinsById.get(next.pinId)?.title) || 'Point on the map';
}
