import { MAX_PLAYERS, PLAYER_IDS } from '@/config/constants';
import type { PlayerId } from '@/types/domain';
import { ByteReader, ByteWriter, DecodeError } from './binary';

/**
 * Messages for POST /api/sync (application/octet-stream).
 *
 * Each player owns their data (it lives in their localStorage); the server only
 * relays each player's latest snapshot and tracks who is online. Revisions are
 * increasing timestamps set by the owner on every change.
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
 *   u8      1 if my snapshot follows, 0 otherwise
 *   ...     snapshot (rest of the message)
 *
 * Response:
 *   u8      protocol version
 *   u32     epoch
 *   varint  seq       — latest sequence on the server
 *   varint  stored    — my revision held by the server (0 = none)
 *   u8      online    — bitmask of online players (bit i = PLAYER_IDS[i])
 *   varint  count     — number of snapshots that follow
 *   count × { u8 player index, varint rev, varint length, snapshot }
 *
 * An idle poll takes ~14 bytes each way.
 */

export const PROTOCOL_VERSION = 3;
export const MAX_SYNC_REQUEST_BYTES = 2048;
const MAX_SNAPSHOT_BYTES = 1024;
const MAX_SYNC_RESPONSE_BYTES = MAX_PLAYERS * (MAX_SNAPSHOT_BYTES + 16) + 32;

export interface SyncRequest {
  epoch: number;
  knownSeq: number;
  rev: number;
  snapshot: Uint8Array | null;
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

export function encodeSyncRequest({ epoch, knownSeq, rev, snapshot }: SyncRequest): Uint8Array {
  const writer = new ByteWriter().u8(PROTOCOL_VERSION).u32(epoch).varint(knownSeq).varint(rev);
  if (snapshot) writer.u8(1).bytes(snapshot);
  else writer.u8(0);
  return writer.finish();
}

export function decodeSyncRequest(bytes: Uint8Array): SyncRequest {
  const reader = readHeader(bytes, MAX_SYNC_REQUEST_BYTES);
  const epoch = reader.u32();
  const knownSeq = reader.varint();
  const rev = reader.varint();
  const flag = reader.u8();
  if (flag === 0) {
    reader.expectEnd();
    return { epoch, knownSeq, rev, snapshot: null };
  }
  if (flag !== 1) throw new DecodeError('Invalid snapshot flag');
  return { epoch, knownSeq, rev, snapshot: reader.rest() };
}

export function encodeSyncResponse({ epoch, seq, storedRev, online, snapshots }: SyncResponse): Uint8Array {
  const onlineMask = online.reduce((mask, player) => mask | (1 << playerIndex(player)), 0);
  const writer = new ByteWriter()
    .u8(PROTOCOL_VERSION)
    .u32(epoch)
    .varint(seq)
    .varint(storedRev)
    .u8(onlineMask)
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
  const onlineMask = reader.u8();
  const online = PLAYER_IDS.filter((_, i) => onlineMask & (1 << i));

  const count = reader.varint();
  if (count > MAX_PLAYERS) throw new DecodeError('Too many snapshots');
  const snapshots: PlayerSnapshot[] = [];
  for (let i = 0; i < count; i++) {
    const player = playerAt(reader.u8());
    const rev = reader.varint();
    snapshots.push({ player, rev, snapshot: reader.sizedBytes(MAX_SNAPSHOT_BYTES).slice() });
  }
  reader.expectEnd();
  return { epoch, seq, storedRev, online, snapshots };
}
