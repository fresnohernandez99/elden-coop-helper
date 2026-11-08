import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createSessionToken, readSessionToken, type Viewer } from './session';

const DAY = 24 * 60 * 60 * 1000;
const viewer: Viewer = { kind: 'player', teamId: 'a'.repeat(24), player: 'p2', joinId: 'join-id-123' };

beforeAll(() => {
  process.env.MONGODB_URI = 'mongodb://unused';
  process.env.SESSION_SECRET = 'test-secret-with-enough-length';
});

afterEach(() => vi.useRealTimers());

describe('session', () => {
  it('lasts 90 days and asks to be renewed after one', () => {
    vi.useFakeTimers({ now: 0 });
    const token = createSessionToken(viewer);
    expect(readSessionToken(token)).toEqual({ viewer, renew: false });
    vi.setSystemTime(DAY + 60_000);
    expect(readSessionToken(token)).toEqual({ viewer, renew: true });
    vi.setSystemTime(89 * DAY);
    expect(readSessionToken(token)?.viewer).toEqual(viewer);
    vi.setSystemTime(90 * DAY + 60_000);
    expect(readSessionToken(token)).toBeNull();
  });

  it('rejects a tampered token', () => {
    const token = createSessionToken(viewer);
    expect(readSessionToken(token.replace(':p2:', ':p1:'))).toBeNull();
  });
});
