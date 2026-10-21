import 'server-only';
import type { NextRequest } from 'next/server';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 10;

interface Attempts {
  count: number;
  resetAt: number;
}

// In globalThis so every route shares it. Best effort: on Vercel each instance has its own.
const globalAttempts = globalThis as typeof globalThis & { __eldenCoopLoginAttempts?: Map<string, Attempts> };
const attempts = (globalAttempts.__eldenCoopLoginAttempts ??= new Map());

/** Client IP as reported by the proxy (Vercel and most hosts set x-forwarded-for). */
export function clientKey(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'local';
}

/** Limits failed password attempts per IP to slow down guessing. */
export const loginRateLimit = {
  isLimited(key: string): boolean {
    const entry = attempts.get(key);
    if (entry && entry.resetAt < Date.now()) attempts.delete(key);
    return (attempts.get(key)?.count ?? 0) >= MAX_FAILED_ATTEMPTS;
  },

  recordFailure(key: string) {
    const entry = attempts.get(key);
    if (entry && entry.resetAt >= Date.now()) entry.count++;
    else attempts.set(key, { count: 1, resetAt: Date.now() + WINDOW_MS });
  },

  reset: (key: string) => attempts.delete(key),
};
