import 'server-only';
import { randomInt } from 'node:crypto';
import { MAX_SPECTATORS, ONLINE_WINDOW_MS, PLAYER_IDS } from '@/config/constants';
import type { PlayerSnapshot } from '@/sync/protocol';
import type { PlayerId } from '@/types/domain';
import { getMembers, getTeam, type TeamMember } from './teams';

/** Members are re-read from the database this often, to notice joins and kicks made on other instances. */
const MEMBERS_REFRESH_MS = 5 * 60_000;
/** An unknown session triggers an early re-read, at most this often per team. */
const FORCED_REFRESH_MS = 10_000;
/** Teams nobody synced with for this long are dropped from memory (not from the database). */
const IDLE_ROOM_MS = 30 * 60_000;

interface RelayEntry {
  rev: number;
  snapshot: Uint8Array;
  /** Relay sequence when it was stored; clients ask for "everything after seq N". */
  seq: number;
  /** Membership that sent it: a snapshot from a kicked player is dropped. */
  joinId: string;
  /** Highest revision known to be saved in the database. */
  persistedRev: number;
}

/**
 * One team in memory: the latest snapshot of each player and who is online.
 *
 * Not the source of truth: data lives in each player's localStorage and their
 * browser re-sends it if the server loses it (restart, deploy or another
 * instance). When a team is first used on an instance, its last saved
 * snapshots are loaded from the database once; after that, polls never read it.
 */
export class Room {
  /** Random per room: tells clients that sequences started over. */
  readonly epoch = randomInt(1, 2 ** 32 - 1);
  seq = 0;
  private readonly entries = new Map<PlayerId, RelayEntry>();
  private readonly lastSeen = new Map<PlayerId, number>();
  /** Spectator id → last sync time. */
  private readonly spectators = new Map<string, number>();
  private members = new Map<PlayerId, string>();
  private membersReadAt = Date.now();
  private forcedReadAt = 0;
  private refreshing: Promise<void> | null = null;
  lastUsed = Date.now();

  constructor(
    readonly teamId: string,
    members: TeamMember[],
  ) {
    this.setMembers(members);
  }

  // ---- members ----

  /** Replaces the member list and forgets snapshots of anyone no longer in the team. */
  private setMembers(members: TeamMember[]) {
    this.members = new Map(members.map((m) => [m.slot, m.joinId]));
    this.membersReadAt = Date.now();
    for (const [player, entry] of this.entries) {
      if (this.members.get(player) !== entry.joinId) this.forget(player);
    }
    for (const player of this.lastSeen.keys()) if (!this.members.has(player)) this.lastSeen.delete(player);
  }

  private refreshMembers(): Promise<void> {
    this.refreshing ??= getMembers(this.teamId)
      .then((members) => this.setMembers(members ?? []))
      .finally(() => (this.refreshing = null));
    return this.refreshing;
  }

  /** Re-reads members in the background when the list is old; the current request does not wait. */
  refreshIfStale() {
    if (Date.now() - this.membersReadAt > MEMBERS_REFRESH_MS) void this.refreshMembers().catch(console.error);
  }

  /**
   * True if the session belongs to a current member. An unknown one may have
   * joined on another instance, so the members are re-read (rate limited).
   */
  async isMember(player: PlayerId, joinId: string): Promise<boolean> {
    if (this.members.get(player) === joinId) return true;
    if (Date.now() - this.forcedReadAt < FORCED_REFRESH_MS) return false;
    this.forcedReadAt = Date.now();
    await this.refreshMembers();
    return this.members.get(player) === joinId;
  }

  addMember(player: PlayerId, joinId: string) {
    if (this.members.get(player) !== joinId) this.forget(player);
    this.members.set(player, joinId);
  }

  removeMember(player: PlayerId) {
    this.members.delete(player);
    this.forget(player);
  }

  memberSlots = (): PlayerId[] => PLAYER_IDS.filter((id) => this.members.has(id));

  private forget(player: PlayerId) {
    this.entries.delete(player);
    this.lastSeen.delete(player);
  }

  // ---- snapshots and presence ----

  /** Puts a snapshot in memory. `persistedRev` is set when it came from the database. */
  store(player: PlayerId, joinId: string, rev: number, snapshot: Uint8Array, persistedRev = 0) {
    const previous = this.entries.get(player);
    const persisted = previous?.joinId === joinId ? Math.max(previous.persistedRev, persistedRev) : persistedRev;
    this.entries.set(player, { rev, snapshot, seq: ++this.seq, joinId, persistedRev: persisted });
  }

  entry = (player: PlayerId): Readonly<RelayEntry> | undefined => this.entries.get(player);

  markPersisted(player: PlayerId, rev: number) {
    const entry = this.entries.get(player);
    if (entry) entry.persistedRev = Math.max(entry.persistedRev, rev);
  }

  markSeen(player: PlayerId) {
    this.lastSeen.set(player, Date.now());
  }

  /** Marks a spectator as watching. False if all seats are taken by others. */
  markSpectator(id: string): boolean {
    const since = Date.now() - ONLINE_WINDOW_MS;
    for (const [other, seenAt] of this.spectators) if (seenAt < since) this.spectators.delete(other);
    if (!this.spectators.has(id) && this.spectators.size >= MAX_SPECTATORS) return false;
    this.spectators.set(id, Date.now());
    return true;
  }

  online(): PlayerId[] {
    const since = Date.now() - ONLINE_WINDOW_MS;
    return [...this.lastSeen].filter(([, seenAt]) => seenAt >= since).map(([player]) => player);
  }

  /**
   * Snapshots of other players stored after `knownSeq`, or all of them if the epoch changed.
   * Spectators pass null and get every player.
   */
  changesFor(player: PlayerId | null, epoch: number, knownSeq: number): PlayerSnapshot[] {
    const after = epoch === this.epoch ? knownSeq : 0;
    return [...this.entries]
      .filter(([id, entry]) => id !== player && entry.seq > after)
      .map(([id, entry]) => ({ player: id, rev: entry.rev, snapshot: entry.snapshot }));
  }
}

// In globalThis so every route shares the same rooms. A pending load is shared too,
// so a burst of first polls reads the database once.
const globalRelay = globalThis as typeof globalThis & {
  __eldenCoopRooms?: Map<string, Promise<Room | null>>;
  __eldenCoopRoomsPrunedAt?: number;
};
const rooms: Map<string, Promise<Room | null>> = (globalRelay.__eldenCoopRooms ??= new Map());

async function loadRoom(teamId: string): Promise<Room | null> {
  const team = await getTeam(teamId);
  if (!team) return null;
  const room = new Room(teamId, team.members);
  for (const { player, rev, snapshot } of team.snapshots) {
    const joinId = team.members.find((m) => m.slot === player)?.joinId;
    if (joinId) room.store(player, joinId, rev, snapshot, rev);
  }
  return room;
}

function pruneIdleRooms() {
  const now = Date.now();
  if (now - (globalRelay.__eldenCoopRoomsPrunedAt ?? 0) < 60_000) return;
  globalRelay.__eldenCoopRoomsPrunedAt = now;
  for (const [teamId, pending] of rooms) {
    void pending.then((room) => {
      if (!room || now - room.lastUsed > IDLE_ROOM_MS) rooms.delete(teamId);
    });
  }
}

export const relay = {
  /** The team's room, loaded from the database the first time; null if the team does not exist. */
  async room(teamId: string): Promise<Room | null> {
    pruneIdleRooms();
    let pending = rooms.get(teamId);
    if (!pending) {
      pending = loadRoom(teamId);
      rooms.set(teamId, pending);
      // Failed or missing: try the database again next time.
      pending.then(
        (room) => room ?? rooms.delete(teamId),
        () => rooms.delete(teamId),
      );
    }
    const room = await pending;
    if (room) {
      room.lastUsed = Date.now();
      room.refreshIfStale();
    }
    return room;
  },

  /** The room if this instance already has it in memory (to apply joins and kicks without loading it). */
  async loaded(teamId: string): Promise<Room | null> {
    return (await rooms.get(teamId)?.catch(() => null)) ?? null;
  },
};
