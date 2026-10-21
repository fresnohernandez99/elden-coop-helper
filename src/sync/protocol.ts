import { ByteReader, ByteWriter, DecodeError } from './binary';

/**
 * Messages for POST /api/sync (application/octet-stream).
 *
 * Each player owns their data (it lives in their localStorage); the server only
 * relays each player's latest snapshot. Revisions are increasing timestamps set
 * by the owner on every change.
 *
 * Request:
 *   u8      protocol version
 *   varint  rev    — the player's current local revision
 *   varint  known  — latest revision of the other player I already have (0 = none)
 *   u8      1 if my snapshot follows, 0 otherwise
 *   ...     snapshot (rest of the message)
 *
 * Response:
 *   u8      protocol version
 *   varint  stored — my revision held by the server (0 = none)
 *   varint  other  — the other player's revision held by the server (0 = none)
 *   u8      1 if the other player's snapshot follows (only when other > known), 0 otherwise
 *   ...     snapshot (rest of the message)
 *
 * An idle poll takes ~9 bytes each way.
 */

export const PROTOCOL_VERSION = 2;
export const MAX_SYNC_MESSAGE_BYTES = 2048;

export interface SyncRequest {
  rev: number;
  knownOtherRev: number;
  snapshot: Uint8Array | null;
}

export interface SyncResponse {
  storedRev: number;
  otherRev: number;
  otherSnapshot: Uint8Array | null;
}

function writeTail(writer: ByteWriter, snapshot: Uint8Array | null) {
  if (snapshot) writer.u8(1).bytes(snapshot);
  else writer.u8(0);
}

function readTail(reader: ByteReader): Uint8Array | null {
  const flag = reader.u8();
  if (flag === 0) {
    reader.expectEnd();
    return null;
  }
  if (flag !== 1) throw new DecodeError('Invalid snapshot flag');
  return reader.rest();
}

function readHeader(bytes: Uint8Array): ByteReader {
  if (bytes.length > MAX_SYNC_MESSAGE_BYTES) throw new DecodeError('Message too large');
  const reader = new ByteReader(bytes);
  const version = reader.u8();
  if (version !== PROTOCOL_VERSION) throw new DecodeError(`Unsupported protocol version: ${version}`);
  return reader;
}

export function encodeSyncRequest({ rev, knownOtherRev, snapshot }: SyncRequest): Uint8Array {
  const writer = new ByteWriter().u8(PROTOCOL_VERSION).varint(rev).varint(knownOtherRev);
  writeTail(writer, snapshot);
  return writer.finish();
}

export function decodeSyncRequest(bytes: Uint8Array): SyncRequest {
  const reader = readHeader(bytes);
  return { rev: reader.varint(), knownOtherRev: reader.varint(), snapshot: readTail(reader) };
}

export function encodeSyncResponse({ storedRev, otherRev, otherSnapshot }: SyncResponse): Uint8Array {
  const writer = new ByteWriter().u8(PROTOCOL_VERSION).varint(storedRev).varint(otherRev);
  writeTail(writer, otherSnapshot);
  return writer.finish();
}

export function decodeSyncResponse(bytes: Uint8Array): SyncResponse {
  const reader = readHeader(bytes);
  return { storedRev: reader.varint(), otherRev: reader.varint(), otherSnapshot: readTail(reader) };
}
