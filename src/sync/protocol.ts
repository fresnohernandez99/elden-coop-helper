import { MAX_PLAYERS, PLAYER_IDS } from '@/config/constants';
import type { PlayerId } from '@/types/domain';
import { ByteReader, ByteWriter, DecodeError } from './binary';

/**
 * Messages for POST /api/sync (application/octet-stream).
 *
 * Each player owns their data (it lives in their localStorage); the server
 * relays each player's latest snapshot within their team and tracks who is
 * online. Revisions are increasing timestamps set by the owner on every change.
 * Now and then the client asks the server to also save its snapshot to the
 * database (`persist`), so spectators can see the last state of a team.
 *
 * The server numbers every stored snapshot with a sequence. A client sends the
 * last sequence it saw and receives only snapshots stored after it, so an idle
 * poll stays tiny no matter how many players there are. The epoch changes when
 * the server restarts (sequences start over), and then the client gets everything.
 *
 * Request:
 *   u8      protocol version
 *   u32     epoch     — server epoch the client knows (0 = none)
 *   varint  knownSeq  — last sequence received in that epoch
 *   varint  rev       — the player's current local revision
 *   u8      flags     — bit 0: my snapshot follows; bit 1: save it to the database
 *   ...     snapshot (rest of the message)
 *
 * Response:
 *   u8      protocol version
 *   u32     epoch
 *   varint  seq       — latest sequence on the server
 *   varint  stored    — my revision held by the server (0 = none)
 *   u8      members   — bitmask of the team's players (bit i = PLAYER_IDS[i]);
 *                       bit 7: my stored revision is also saved in the database
 *   u8      online    — bitmask of online players
 *   varint  count     — number of snapshots that follow
 *   count × { u8 player index, varint rev, varint length, snapshot }
 *
 * An idle poll takes ~14 bytes up and ~16 down.
 */

export const PROTOCOL_VERSION = 4;
export const MAX_SYNC_REQUEST_BYTES = 2048;
const MAX_SNAPSHOT_BYTES = 1024;
const MAX_SYNC_RESPONSE_BYTES = MAX_PLAYERS * (MAX_SNAPSHOT_BYTES + 16) + 32;

const FLAG_SNAPSHOT = 1;
const FLAG_PERSIST = 2;
const MEMBERS_PERSISTED = 0x80;

export interface SyncRequest {
  epoch: number;
  knownSeq: number;
  rev: number;
  snapshot: Uint8Array | null;
  /** Also save my snapshot to the database. */
  persist: boolean;
}

export interface PlayerSnapshot {
  player: PlayerId;
  rev: number;
  snapshot: Uint8Array;
}

export interface SyncResponse {
  epoch: number;
  seq: number;
  storedRev: number;
  /** `storedRev` is also saved in the database (as far as this server instance knows). */
  persisted: boolean;
  members: PlayerId[];
  online: PlayerId[];
  snapshots: PlayerSnapshot[];
}

function readHeader(bytes: Uint8Array, maxBytes: number): ByteReader {
  if (bytes.length > maxBytes) throw new DecodeError('Message too large');
  const reader = new ByteReader(bytes);
  const version = reader.u8();
  if (version !== PROTOCOL_VERSION) throw new DecodeError(`Unsupported protocol version: ${version}`);
  return reader;
}

function playerAt(index: number): PlayerId {
  const player = PLAYER_IDS[index];
  if (!player) throw new DecodeError(`Unknown player index: ${index}`);
  return player;
}

const playerIndex = (player: PlayerId) => PLAYER_IDS.indexOf(player);

const toMask = (players: PlayerId[]) => players.reduce((mask, player) => mask | (1 << playerIndex(player)), 0);
const fromMask = (mask: number) => PLAYER_IDS.filter((_, i) => mask & (1 << i));

export function encodeSyncRequest({ epoch, knownSeq, rev, snapshot, persist }: SyncRequest): Uint8Array {
  const flags = (snapshot ? FLAG_SNAPSHOT : 0) | (persist ? FLAG_PERSIST : 0);
  const writer = new ByteWriter().u8(PROTOCOL_VERSION).u32(epoch).varint(knownSeq).varint(rev).u8(flags);
  if (snapshot) writer.bytes(snapshot);
  return writer.finish();
}

export function decodeSyncRequest(bytes: Uint8Array): SyncRequest {
  const reader = readHeader(bytes, MAX_SYNC_REQUEST_BYTES);
  const epoch = reader.u32();
  const knownSeq = reader.varint();
  const rev = reader.varint();
  const flags = reader.u8();
  if (flags & ~(FLAG_SNAPSHOT | FLAG_PERSIST)) throw new DecodeError('Invalid flags');
  const persist = (flags & FLAG_PERSIST) !== 0;
  if (!(flags & FLAG_SNAPSHOT)) {
    reader.expectEnd();
    return { epoch, knownSeq, rev, snapshot: null, persist };
  }
  return { epoch, knownSeq, rev, snapshot: reader.rest(), persist };
}

export function encodeSyncResponse(response: SyncResponse): Uint8Array {
  const { epoch, seq, storedRev, persisted, members, online, snapshots } = response;
  const writer = new ByteWriter()
    .u8(PROTOCOL_VERSION)
    .u32(epoch)
    .varint(seq)
    .varint(storedRev)
    .u8(toMask(members) | (persisted ? MEMBERS_PERSISTED : 0))
    .u8(toMask(online))
    .varint(snapshots.length);
  for (const entry of snapshots) {
    writer.u8(playerIndex(entry.player)).varint(entry.rev).sizedBytes(entry.snapshot);
  }
  return writer.finish();
}

export function decodeSyncResponse(bytes: Uint8Array): SyncResponse {
  const reader = readHeader(bytes, MAX_SYNC_RESPONSE_BYTES);
  const epoch = reader.u32();
  const seq = reader.varint();
  const storedRev = reader.varint();
  const membersByte = reader.u8();
  const persisted = (membersByte & MEMBERS_PERSISTED) !== 0;
  const members = fromMask(membersByte & ~MEMBERS_PERSISTED);
  const online = fromMask(reader.u8());

  const count = reader.varint();
  if (count > MAX_PLAYERS) throw new DecodeError('Too many snapshots');
  const snapshots: PlayerSnapshot[] = [];
  for (let i = 0; i < count; i++) {
    const player = playerAt(reader.u8());
    const rev = reader.varint();
    snapshots.push({ player, rev, snapshot: reader.sizedBytes(MAX_SNAPSHOT_BYTES).slice() });
  }
  reader.expectEnd();
  return { epoch, seq, storedRev, persisted, members, online, snapshots };
}
