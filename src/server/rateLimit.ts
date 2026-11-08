import 'server-only';
import type { NextRequest } from 'next/server';

interface Attempts {
  count: number;
  resetAt: number;
}

// In globalThis so every route shares them. Best effort: on Vercel each instance has its own.
const globalLimits = globalThis as typeof globalThis & { __eldenCoopRateLimits?: Map<string, Map<string, Attempts>> };
const limits = (globalLimits.__eldenCoopRateLimits ??= new Map());

/** Client IP as reported by the proxy (Vercel and most hosts set x-forwarded-for). */
export function clientKey(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'local';
}

/** Counts attempts per key (an IP) and blocks it after `max` within `windowMs`. */
function createRateLimit(name: string, max: number, windowMs: number) {
  const attempts = limits.get(name) ?? new Map<string, Attempts>();
  limits.set(name, attempts);

  return {
    isLimited(key: string): boolean {
      const entry = attempts.get(key);
      if (entry && entry.resetAt < Date.now()) attempts.delete(key);
      return (attempts.get(key)?.count ?? 0) >= max;
    },

    record(key: string) {
      const entry = attempts.get(key);
      if (entry && entry.resetAt >= Date.now()) entry.count++;
      else attempts.set(key, { count: 1, resetAt: Date.now() + windowMs });
    },

    reset: (key: string) => attempts.delete(key),
  };
}

/** Wrong team passwords, to slow down guessing. */
export const joinRateLimit = createRateLimit('join', 10, 15 * 60_000);

/** New teams per IP: teams are never deleted, so creating them is limited. */
export const createTeamRateLimit = createRateLimit('create-team', 5, 60 * 60_000);
