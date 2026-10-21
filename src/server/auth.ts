import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { PLAYER_IDS } from '@/config/constants';
import type { PlayerId } from '@/types/domain';
import { getConfig } from './config';

// Hashes are compared so both sides always have the same length.
const digest = (value: string) => createHash('sha256').update(value).digest();

/** Returns the player who owns the password, or null. */
export function playerForPassword(password: string): PlayerId | null {
  if (!password) return null;
  const { passwords } = getConfig();
  const candidate = digest(password);
  let match: PlayerId | null = null;
  // Check every player so response time does not reveal which one matched.
  for (const id of PLAYER_IDS) {
    if (timingSafeEqual(candidate, digest(passwords[id]))) match = id;
  }
  return match;
}
