import type { PlayerId } from '@/types/domain';
import { toApiError } from './http';

/** Session endpoints. The session itself lives in an httpOnly cookie. */
export const authApi = {
  async login(password: string): Promise<PlayerId> {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) throw await toApiError(res);
    return ((await res.json()) as { player: PlayerId }).player;
  },

  /** Read-only spectator session; no password. Fails with 503 when every seat is taken. */
  async watch(): Promise<void> {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spectator: true }),
    });
    if (!res.ok) throw await toApiError(res);
  },

  async logout(): Promise<void> {
    const res = await fetch('/api/logout', { method: 'POST' });
    if (!res.ok) throw await toApiError(res);
  },
};
